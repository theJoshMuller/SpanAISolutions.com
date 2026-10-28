import type { Store } from '@netlify/blobs';
import { afterEach, expect, test, vi } from 'vitest';
const blobs = vi.hoisted(() => ({get:vi.fn().mockResolvedValue(null),getWithMetadata:vi.fn<Store['getWithMetadata']>().mockResolvedValue(null),set:vi.fn<Store['set']>().mockResolvedValue({modified:true,etag:'new'}),delete:vi.fn().mockResolvedValue(undefined),list:vi.fn(async function*(){yield {blobs:[{key:'first'}]};yield {blobs:[{key:'second'}]};})}));
vi.mock('@netlify/blobs',()=>({getStore:vi.fn(()=>blobs)}));
import quiz,{config as quizConfig} from '../../netlify/functions/quiz';
import optin,{config as optinConfig} from '../../netlify/functions/optin';
import replay,{config as replayConfig} from '../../netlify/functions/quiz-replay';
import {store,rateStore} from '../../netlify/lib/runtime';
afterEach(()=>vi.unstubAllGlobals());
test('paused wrappers reject every submission without parsing or networking',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Unexpected network');}));
 for(const method of ['GET','POST']) {
  const request=(path:string)=>new Request('https://example.test'+path,{method,...(method==='POST'?{body:'{'}:{})});
  expect((await quiz(request('/api/quiz'))).status).toBe(410);
  expect((await optin(request('/api/optin'))).status).toBe(410);
 }
 expect(fetch).not.toHaveBeenCalled();
 expect(quizConfig.path).toEqual(['/api/quiz','/quiz','/quiz/*']);
 expect(optinConfig.path).toBe('/api/optin');
 expect(replayConfig).not.toHaveProperty('schedule');
});
test('old quiz links redirect home without forwarding personal data or tokens',async()=>{
 for(const path of ['/quiz','/quiz/','/quiz/subscribed?s=old&e=private%40example.com&t=signed']) {
  const response=await quiz(new Request('https://example.test'+path));
  expect(response.status).toBe(302);expect(response.headers.get('Location')).toBe('/');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
 }
});
test('blob adapter lists every page and uses text reads',async()=>{
 const kv=store('quiz-outbox');expect(await kv.list('')).toEqual(['first','second']);await kv.get('first');expect(blobs.get).toHaveBeenCalledWith('first',{type:'text'});
});
test('paused replay has no schedule and cannot touch the retained outbox',async()=>{
 for(const mock of [blobs.get,blobs.list,blobs.delete])mock.mockClear();
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Unexpected network');}));
 const response=await replay();expect(response.status).toBe(410);expect(fetch).not.toHaveBeenCalled();
 expect(blobs.get).not.toHaveBeenCalled();expect(blobs.list).not.toHaveBeenCalled();expect(blobs.delete).not.toHaveBeenCalled();
 expect(replayConfig).not.toHaveProperty('schedule');
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
test('paused quiz bypasses storage entirely even for a valid old submission',async()=>{
 blobs.getWithMetadata.mockReset().mockRejectedValue(new Error('offline'));
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Unexpected network');}));
 const body={submissionId:'123e4567-e89b-42d3-a456-426614174000',startedAt:new Date(Date.now()-30000).toISOString(),website:'',
   answers:{A1:'owner',A2:'10-49',B1:2,B2:2,B3:2,B4:2,B5:2,C1:'Building weekly reports',C2:'5-10',C3:3,C4:null,D1:'for',D2:null},
   contact:{firstName:'Jane',email:'jane@acme.org',organization:'Acme',phone:null},
   attribution:{utm_source:null,utm_medium:null,utm_campaign:null,referrer:null,landingPath:'/quiz'}};
 const response=await quiz(new Request('https://example.test/api/quiz',{method:'POST',body:JSON.stringify(body)}));
 expect(response.status).toBe(410);
 expect(await response.json()).toEqual({ok:false,error:'Quiz is paused.'});
 expect(blobs.getWithMetadata).not.toHaveBeenCalled();
 expect(fetch).not.toHaveBeenCalled();
});
