
import 'dotenv/config';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { supabaseClient } from './supabase';
import { larkClient } from './lark';

let totalPageCount = 0;

/* Split the text into chunks */
const textSplitter = new RecursiveCharacterTextSplitter();

async function addDocumentToVectorStore(vectorStore: SupabaseVectorStore, title: string, content: string, url: string) {
  const chunks = await textSplitter.splitDocuments([
    new Document({ pageContent: `# ${title}\n${content}`, metadata: { title, url } }),
  ]);
  
  await vectorStore.addDocuments(chunks);
}

async function processDocx(token: string) {
  const rawContent = await larkClient.docx.document.rawContent({
    path: {
      document_id: token,
    },
  })

  return rawContent.data?.content
}

async function processDoc(token: string) {
  const resp = await larkClient.request({
    url: `https://open.feishu.cn/open-apis/doc/v2/${token}/raw_content`,
  })

  return resp.data?.content
}

function getDocUrl(token: string) {
  return `https://bytedance.feishu.cn/wiki/${token}`
}

async function loopOverWikiPages(vectorStore: SupabaseVectorStore, parentNodeToken?: string, level = 0) {
  const levelPrefix = level === 0 ? '' : ' '.repeat(level * 2)

  const iterator = await larkClient.wiki.spaceNode.listWithIterator({
    path: {
      space_id: process.env.SPACE_ID!,
    },
    params: {
      parent_node_token: parentNodeToken
    },
  })

  for await (const list of iterator) {
    if (!list?.items) {
      continue
    }

    for (const page of list.items) {
      console.log(`${levelPrefix}${page.title} - ${page.obj_type} - ${page.obj_token}`)
      totalPageCount += 1

      if (page.obj_type === 'doc') {
        const content = await processDoc(page.obj_token!)
        if (content) {
          await addDocumentToVectorStore(vectorStore, page.title!, content, getDocUrl(page.node_token!))
          // return
        }
      }

      if (page.obj_type === 'docx') {
        const content = await processDocx(page.obj_token!)
        if (content) {
          await addDocumentToVectorStore(vectorStore, page.title!, content, getDocUrl(page.node_token!))
          // return
        }
      }

      if (page.has_child) {
        await loopOverWikiPages(vectorStore, page.node_token, level + 1)
      }
    }
  }
};

(async () => {
  /* Create the vectorstore */
  const vectorStore = await SupabaseVectorStore.fromExistingIndex(new OpenAIEmbeddings(), {
    client: supabaseClient,
    tableName: 'documents',
    queryName: 'match_documents',
  });
  await loopOverWikiPages(vectorStore);
  console.log(`Total pages: ${totalPageCount}`)
})()