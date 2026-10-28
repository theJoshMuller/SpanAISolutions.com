import { getStore } from '@netlify/blobs';
import type { KV, QuizEnv } from './quiz-handler';
export function store(name: string): KV {
  const blobs = getStore({ name, consistency: 'strong' });
  return {
    get: key => blobs.get(key, { type: 'text' }),
    set: async (key, value) => { await blobs.set(key, value); },
    delete: key => blobs.delete(key),
    list: async prefix => {
      const keys: string[] = [];
      for await (const page of blobs.list({ prefix, paginate: true })) keys.push(...page.blobs.map(blob => blob.key));
      return keys;
    },
  };
}
export function environment(): QuizEnv {
  const { env } = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }).process;
  return {
    N8N_QUIZ_WEBHOOK_URL: env.N8N_QUIZ_WEBHOOK_URL ?? '',
    N8N_OPTIN_WEBHOOK_URL: env.N8N_OPTIN_WEBHOOK_URL ?? '',
    N8N_QUIZ_SECRET: env.N8N_QUIZ_SECRET ?? '',
    OPTIN_SIGNING_KEY: env.OPTIN_SIGNING_KEY ?? '',
    CONTEXT: env.CONTEXT ?? '',
  };
}
