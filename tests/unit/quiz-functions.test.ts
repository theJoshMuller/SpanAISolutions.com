import { afterEach, expect, test, vi } from 'vitest';
const blobs = vi.hoisted(() => ({get:vi.fn().mockResolvedValue(null),set:vi.fn().mockResolvedValue(undefined),delete:vi.fn().mockResolvedValue(undefined),list:vi.fn(async function*(){yield {blobs:[{key:'first'}]};yield {blobs:[{key:'second'}]};})}));
vi.mock('@netlify/blobs',()=>({getStore:vi.fn(()=>blobs)}));
import quiz,{config as quizConfig} from '../../netlify/functions/quiz';
import optin,{config as optinConfig} from '../../netlify/functions/optin';
import replay,{config as replayConfig} from '../../netlify/functions/quiz-replay';
import {store} from '../../netlify/lib/runtime';
import type { Context } from '@netlify/functions';
afterEach(()=>vi.unstubAllGlobals());
test('wrappers reject non-POST and malformed JSON locally',async()=>{
 const ctx={ip:'127.0.0.1'} as Context;
 expect((await quiz(new Request('https://example.test/api/quiz'),ctx)).status).toBe(405);
 expect((await optin(new Request('https://example.test/api/optin'))).status).toBe(405);
 const request=()=>new Request('https://example.test/api/quiz',{method:'POST',body:'{'});
 expect((await quiz(request(),ctx)).status).toBe(400);
 expect((await optin(request())).status).toBe(400);
 expect(quizConfig.path).toBe('/api/quiz');expect(optinConfig.path).toBe('/api/optin');expect(replayConfig.schedule).toBe('*/10 * * * *');
});
test('blob adapter lists every page and uses text reads',async()=>{
 const kv=store('quiz-outbox');expect(await kv.list('')).toEqual(['first','second']);await kv.get('first');expect(blobs.get).toHaveBeenCalledWith('first',{type:'text'});
});
test('scheduled wrapper runs against injected local blob store without networking',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Unexpected network');}));
 const response=await replay();expect(await response.json()).toEqual({sent:0,failed:0});expect(fetch).not.toHaveBeenCalled();
});
