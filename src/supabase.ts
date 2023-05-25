import { createClient } from '@supabase/supabase-js';
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import 'dotenv/config';

const privateKey = process.env.SUPABASE_PRIVATE_KEY;
if (!privateKey) throw new Error(`Expected env var SUPABASE_PRIVATE_KEY`);

const url = process.env.SUPABASE_URL;
if (!url) throw new Error(`Expected env var SUPABASE_URL`);

export const supabaseClient = createClient(url, privateKey);