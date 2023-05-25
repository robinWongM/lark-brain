import 'dotenv/config';
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalRetrievalQAChain, LLMChain } from "langchain/chains";
import * as readline from 'node:readline/promises';
import { PromptTemplate } from 'langchain/prompts';
import { supabaseClient } from './supabase';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { larkClient } from './lark';

const questionGeneratorTemplate = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question in Chinese.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const qaTemplate = `你是一位网管的助手，请使用下面的资料回答网管的问题（位于最后）。如果你不知道问题的答案，直接说不知道，不要尝试虚构答案。

{context}

Q: {question}
A: `;

function debounce<T extends Function>(cb: T, wait = 20) {
  let h: NodeJS.Timeout;
  let callable = (...args: any) => {
      clearTimeout(h);
      h = setTimeout(() => cb(...args), wait);
  };
  return <T>(<any>callable);
}

export const run = async (question: string, messageId: string) => {
  let answer = '';
  let replyMessageId: string | undefined = '';

  const debouncedUpdate = debounce(() => {
    if (!replyMessageId) {
      return;
    }

    larkClient.im.message.patch({
      path: {
        message_id: replyMessageId,
      },
      data: {
        content: JSON.stringify({
          "elements": [
            {
              "tag": "markdown",
              "content": answer,
            }
          ]
        }),
      },
    });
  }, 500);

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
                  "content": answer,
                }
              ]
            }),
          },
        });

        replyMessageId = resp.data?.message_id;
      },
      handleLLMNewToken(token: string) {
        answer += token;
        debouncedUpdate();
      },
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

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let chatHistory = '';

  await chain.call({ question, chat_history: chatHistory });
};