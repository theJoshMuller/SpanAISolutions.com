import { getStore } from '@netlify/blobs';
import type { KV, QuizEnv, RateStore } from './quiz-handler';
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
export function rateStore(name: string): RateStore {
  const blobs = getStore({ name, consistency: 'strong' });
  return {
    reserve: async (key, limit) => {
      // Every writer must win a conditional write before forwarding. Strong
      // reads alone do not serialize a read/check/write counter.
      for (let attempt = 0; attempt < 8; attempt++) {
        const entry = await blobs.getWithMetadata(key, { type: 'text' });
        const count = entry === null ? 0 : Number(entry.data);
        if (entry && (!/^\d+$/.test(entry.data) || !Number.isSafeInteger(count) || !entry.etag)) {
          throw new Error('Invalid rate counter state');
        }
        if (count >= limit) return false;
        const result = await blobs.set(key, String(count + 1),
          entry === null ? { onlyIfNew: true } : { onlyIfMatch: entry.etag! });
        if (result.modified) return true;
      }
      // The wrapper returns 503; never grant a slot after a failed reservation.
      throw new Error('Rate reservation conflict limit reached');
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
