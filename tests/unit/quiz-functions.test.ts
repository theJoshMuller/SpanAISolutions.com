import type { Store } from '@netlify/blobs';
import { afterEach, expect, test, vi } from 'vitest';
const blobs = vi.hoisted(() => ({get:vi.fn().mockResolvedValue(null),getWithMetadata:vi.fn<Store['getWithMetadata']>().mockResolvedValue(null),set:vi.fn<Store['set']>().mockResolvedValue({modified:true,etag:'new'}),delete:vi.fn().mockResolvedValue(undefined),list:vi.fn(async function*(){yield {blobs:[{key:'first'}]};yield {blobs:[{key:'second'}]};})}));
vi.mock('@netlify/blobs',()=>({getStore:vi.fn(()=>blobs)}));
import quiz,{config as quizConfig} from '../../netlify/functions/quiz';
import optin,{config as optinConfig} from '../../netlify/functions/optin';
import replay,{config as replayConfig} from '../../netlify/functions/quiz-replay';
import {store,rateStore} from '../../netlify/lib/runtime';
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

test('rate reservations retry create and update conflicts using fresh etags',async()=>{
 blobs.getWithMetadata.mockReset().mockResolvedValueOnce(null)
   .mockResolvedValueOnce({data:'3',etag:'old',metadata:{}})
   .mockResolvedValueOnce({data:'4',etag:'fresh',metadata:{}});
 blobs.set.mockReset().mockResolvedValueOnce({modified:false})
   .mockResolvedValueOnce({modified:false}).mockResolvedValueOnce({modified:true,etag:'five'});
 expect(await rateStore('quiz-rate').reserve('ip:hour',5)).toBe(true);
 expect(blobs.set.mock.calls).toEqual([
   ['ip:hour','1',{onlyIfNew:true}],
   ['ip:hour','4',{onlyIfMatch:'old'}],
   ['ip:hour','5',{onlyIfMatch:'fresh'}],
 ]);
 expect(blobs.getWithMetadata).toHaveBeenCalledWith('ip:hour',{type:'text'});
 blobs.getWithMetadata.mockResolvedValue({data:'5',etag:'five',metadata:{}});
 expect(await rateStore('quiz-rate').reserve('ip:hour',5)).toBe(false);
 expect(blobs.set).toHaveBeenCalledTimes(3);
});
test('rate reservations fail closed on storage errors, invalid state and exhausted conflicts',async()=>{
 const rate=rateStore('quiz-rate');
 blobs.getWithMetadata.mockReset().mockRejectedValueOnce(new Error('offline'));
 await expect(rate.reserve('ip:hour',5)).rejects.toThrow('offline');
 for(const entry of [{data:'bad',etag:'e',metadata:{}},{data:'4',etag:'',metadata:{}}]) {
   blobs.getWithMetadata.mockResolvedValue(entry);
   await expect(rate.reserve('ip:hour',5)).rejects.toThrow();
 }
 blobs.getWithMetadata.mockResolvedValue({data:'4',etag:'e',metadata:{}});
 blobs.set.mockReset().mockRejectedValueOnce(new Error('write failed'));
 await expect(rate.reserve('ip:hour',5)).rejects.toThrow('write failed');
 blobs.set.mockReset().mockResolvedValue({modified:false});
 await expect(rate.reserve('ip:hour',5)).rejects.toThrow();
 expect(blobs.set.mock.calls.length).toBeGreaterThan(1);
 expect(blobs.set.mock.calls.length).toBeLessThanOrEqual(10);
});

test('independent Blob rate adapters reserve exactly five under concurrent contention',async()=>{
 let current: {data:string;etag:string;metadata:Record<string,unknown>} | null=null;
 blobs.getWithMetadata.mockReset().mockImplementation(async()=>current && {...current});
 blobs.set.mockReset().mockImplementation(async(_key,value,options)=>{
   const matches=options?.onlyIfNew ? current===null : current?.etag===options?.onlyIfMatch;
   if(!matches) return {modified:false};
   current={data:String(value),etag:`version-${value}`,metadata:{}};
   return {modified:true,etag:current.etag};
 });
 const results=await Promise.all(Array.from({length:20},()=>rateStore('quiz-rate').reserve('ip:hour',5)));
 expect(results.filter(Boolean)).toHaveLength(5);
 expect(results.filter(r=>!r)).toHaveLength(15);
 expect(current).toMatchObject({data:'5'});
});
test('quiz wrapper returns 503 without delivery when reservation storage fails',async()=>{
 blobs.getWithMetadata.mockReset().mockRejectedValue(new Error('offline'));
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Unexpected network');}));
 const body={submissionId:'123e4567-e89b-42d3-a456-426614174000',startedAt:new Date(Date.now()-30000).toISOString(),website:'',
   answers:{A1:'owner',A2:'10-49',B1:2,B2:2,B3:2,B4:2,B5:2,C1:'Building weekly reports',C2:'5-10',C3:3,C4:null,D1:'for',D2:null},
   contact:{firstName:'Jane',email:'jane@acme.org',organization:'Acme',phone:null},
   attribution:{utm_source:null,utm_medium:null,utm_campaign:null,referrer:null,landingPath:'/quiz'}};
 const response=await quiz(new Request('https://example.test/api/quiz',{method:'POST',body:JSON.stringify(body)}),{ip:'127.0.0.1'} as Context);
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({ok:false});
 expect(fetch).not.toHaveBeenCalled();
});
