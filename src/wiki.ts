import * as lark from '@larksuiteoapi/node-sdk'
import 'dotenv/config';

const client = new lark.Client({
  appId: process.env.APP_ID!,
  appSecret: process.env.APP_SECRET!,
})

let totalPageCount = 0;

async function loopOverWikiPages(parentNodeToken?: string, level = 0) {
  const levelPrefix = level === 0 ? '' : ' '.repeat(level * 2)

  const iterator = await client.wiki.spaceNode.listWithIterator({
    path: {
      space_id: process.env.SPACE_ID!,
    },
    params: {
      parent_node_token: parentNodeToken,
      page_size: 1,
    },
  })

  for await (const list of iterator) {
    if (!list?.items) {
      continue
    }

    for (const page of list.items) {
      console.log(`${levelPrefix}${page.title}`)
      totalPageCount += 1
      if (page.has_child) {
        await loopOverWikiPages(page.node_token, level + 1)
      }
    }
  }
};

loopOverWikiPages();