import 'dotenv/config';
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalRetrievalQAChain, LLMChain } from "langchain/chains";
import * as readline from 'node:readline/promises';
import { PromptTemplate } from 'langchain/prompts';
import { supabaseClient } from './supabase';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { larkClient } from './lark';
import { BehaviorSubject, Subject, first, reduce, scan, skip, tap, throttleTime, withLatestFrom } from 'rxjs';

const questionGeneratorTemplate = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question in Chinese.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const qaTemplate = `你是一位网管的助手，请使用下面的资料回答网管的问题（位于最后）。如果你不知道问题的答案，直接说不知道，不要尝试虚构答案。

{context}

Q: {question}
A: `;

interface Source {
  title: string;
  url: string;
}

function updateMessage(messageId: string, answer: string, sources: Source[] = []) {
  larkClient.im.message.patch({
    path: {
      message_id: messageId,
    },
    data: {
      content: JSON.stringify({
        "elements": [
          {
            "tag": "markdown",
            "content": answer,
          },
          ...(sources.length ? [
            {
              "tag": "hr",
            },
            {
              "tag": "markdown",
              "content": `引用来源：\n${sources.map(({ title, url }) => `- [${title}](${url})`).join('\n')}`,
            }
          ]: [])
        ]
      }),
    },
  });
}

export const run = async (question: string, messageId: string) => {
  console.log(`[${messageId}] Received question: ${question}`);

  const answer = new Subject<string>();
  const sources = new BehaviorSubject<Source[]>([]);
  let replyMessageId: string | undefined = '';

  const vectorStore = await SupabaseVectorStore.fromExistingIndex(new OpenAIEmbeddings(), {
    client: supabaseClient,
    tableName: 'documents',
    queryName: 'match_documents',
  });
  /* Initialize the LLM to use to answer the question */
  const streamingModel = new ChatOpenAI({
    streaming: true,
    temperature: 0.3,
    callbacks: [{
      async handleLLMStart() {
        const resp = await larkClient.im.message.reply({
          path: {
            message_id: messageId,
          },
          data: {
            msg_type: 'interactive',
            content: JSON.stringify({
              "elements": [
                {
                  "tag": "markdown",
                  "content": '正在思考中...',
                }
              ]
            }),
          },
        });
    
        replyMessageId = resp.data?.message_id;
      },
      handleLLMNewToken(token: string) {
        answer.next(token);
      },
      handleLLMEnd() {
        answer.complete();
      }
    }]
  });
  const model = new ChatOpenAI();
  /* Create the chain */
  const chain = ConversationalRetrievalQAChain.fromLLM(
    streamingModel,
    vectorStore.asRetriever(),
    {
      questionGeneratorTemplate,
      qaTemplate,
      returnSourceDocuments: true,
    }
  );

  chain.questionGeneratorChain = new LLMChain({ prompt: PromptTemplate.fromTemplate(questionGeneratorTemplate), llm: model });
  let chatHistory = '';

  answer.pipe(
    scan((acc, curr) => acc + curr, ''),
    throttleTime(250, undefined, { leading: true, trailing: true }),
    withLatestFrom(sources),
    tap(([answer, sources]) => {
      if (!replyMessageId) {
        return;
      }

      updateMessage(replyMessageId, answer, sources);
    }),
  ).subscribe();

  const finalAnswer = await chain.call({ question, chat_history: chatHistory });
  
  sources.next(finalAnswer.sourceDocuments.map((doc: any) => ({ title: doc.metadata.title, url: doc.metadata.url })));
  sources.complete();

  console.log(`[${messageId}] Answer: ${finalAnswer.text}`);
};