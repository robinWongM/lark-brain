import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { dispatcher, larkClient } from './lark'
import * as lark from '@larksuiteoapi/node-sdk';
import { run } from './qa';

const app = new Hono()
app.get('/', (c) => c.text('Hello Hono!'))

dispatcher.register({
  "im.message.receive_v1": (data) => {
    if (data.message.message_type !== 'text') {
      larkClient.im.message.reply({
        path: {
          message_id: data.message.message_id,
        },
        data: {
          content: JSON.stringify({
            text: '不支持的消息类型，目前只支持文本消息。',
          }),
          msg_type: 'text',
        }
      })

      return;
    }

    const content = data.message.content;
    const { text } = JSON.parse(content);
    run(text, data.message.message_id);
  }
})

app.post('/events', async (c) => {
  const body = await c.req.json()

  const data = Object.assign(Object.create({
    headers: Object.fromEntries(c.req.headers.entries()),
  }), body);

  const { isChallenge, challenge } = lark.generateChallenge(data, {
      encryptKey: dispatcher.encryptKey,
  });

  if (isChallenge) {
    return c.json(challenge);
  }

  void dispatcher.invoke(data);
  c.status(200);
  return c.json({ code: 0 });
})

serve(app)