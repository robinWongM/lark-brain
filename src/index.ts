import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import './wiki'

const app = new Hono()
app.get('/', (c) => c.text('Hello Hono!'))

serve(app)