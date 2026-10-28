import { afterEach, expect, test, vi } from 'vitest';
import { handleQuizSubmission, handleOptin, replayOutbox, type KV, type QuizEnv } from '../../netlify/lib/quiz-handler';
import { signOptin } from '../../netlify/lib/token';
import { scoreAll } from '../../src/quiz/scoring';
class Memory implements KV {
  data = new Map<string,string>();
  async get(k:string) { return this.data.get(k) ?? null; }
  async set(k:string,v:string) { this.data.set(k,v); }
  async delete(k:string) { this.data.delete(k); }
  async list(prefix:string) { return [...this.data.keys()].filter(k=>k.startsWith(prefix)); }
}
const env: QuizEnv = { N8N_QUIZ_WEBHOOK_URL:'https://example.test/quiz', N8N_OPTIN_WEBHOOK_URL:'https://example.test/optin', N8N_QUIZ_SECRET:'test-secret', OPTIN_SIGNING_KEY:'test-key', CONTEXT:'production' };
const now = Date.parse('2026-10-27T12:00:30Z');
function payload() { return { submissionId:'123e4567-e89b-42d3-a456-426614174000', startedAt:new Date(now-30000).toISOString(), website:'', answers:{ A1:'owner', A2:'10-49', B1:2,B2:2,B3:2,B4:2,B5:2,C1:'Building weekly reports',C2:'5-10',C3:3,C4:null,D1:'for',D2:null },contact:{firstName:'Jane',email:' Jane@Acme.ORG ',organization:'Acme',phone:null},attribution:{utm_source:null,utm_medium:null,utm_campaign:null,referrer:null,landingPath:'/quiz'} }; }
function context() { return {ip:'1.2.3.4',now,env,fetch:vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:200})),outbox:new Memory(),rate:new Memory()}; }
afterEach(()=>vi.useRealTimers());
test('normalizes email, strips untrusted fields and recomputes results',async()=>{
 const ctx=context(), p=payload(); const r=await handleQuizSubmission({...p,segment:'course',result:{aiLevel:100},extra:'bad'},ctx);
 expect(r.status).toBe(200); const e=JSON.parse(ctx.fetch.mock.calls[0][1]!.body as string);
 expect(e.contact.email).toBe('jane@acme.org'); expect(e.result).toEqual(scoreAll(p.answers as never)); expect(e).not.toHaveProperty('website'); expect(e).not.toHaveProperty('extra'); expect(e).not.toHaveProperty('segment'); expect(e.test).toBe(false);
 expect(r.body.optinToken).toBe(signOptin(p.submissionId,'jane@acme.org',env.OPTIN_SIGNING_KEY));
 expect(ctx.fetch.mock.calls[0][1]!.headers).toMatchObject({'X-Span-Quiz-Secret':'test-secret'});
});
test('silently accepts honeypots and fast submissions without forwarding',async()=>{
 for(const p of [{...payload(),website:'bot'},{...payload(),website:' '},{...payload(),startedAt:new Date(now-5000).toISOString()}]) { const ctx=context(); expect(await handleQuizSubmission(p,ctx)).toEqual({status:202,body:{ok:true}}); expect(ctx.fetch).not.toHaveBeenCalled(); }
});
test('rejects invalid body and bounded contact fields',async()=>{
 for(const p of [null,{}, {...payload(),submissionId:'../bad'}, {...payload(),startedAt:'bad'}, {...payload(),contact:{...payload().contact,email:'bad'}}, {...payload(),contact:{...payload().contact,firstName:'x'.repeat(81)}}, {...payload(),answers:{}}]) { const ctx=context(); expect((await handleQuizSubmission(p,ctx)).status).toBe(400); expect(ctx.fetch).not.toHaveBeenCalled(); }
});
test('sixth submission in same IP hour is rate limited',async()=>{const ctx=context(); for(let i=0;i<5;i++) expect((await handleQuizSubmission(payload(),ctx)).status).toBe(200); expect((await handleQuizSubmission(payload(),ctx)).status).toBe(429); expect(ctx.rate.data.get('1.2.3.4:2026102712')).toBe('5');});
test('500 and network failures queue submission',async()=>{for(const failure of [()=>Promise.resolve(new Response('',{status:500})),()=>Promise.reject(new Error('offline'))]) {const ctx=context();ctx.fetch.mockImplementation(failure);expect((await handleQuizSubmission(payload(),ctx)).status).toBe(200); expect(ctx.outbox.data.size).toBe(1);}});
test('hung fetch resolves within five seconds even when signal is ignored',async()=>{
 vi.useFakeTimers();const ctx=context();ctx.fetch.mockImplementation(()=>new Promise(()=>{})); const pending=handleQuizSubmission(payload(),ctx); await vi.advanceTimersByTimeAsync(4001);expect((await pending).status).toBe(200);expect(ctx.outbox.data.size).toBe(1);
});
test('replay deletes only successful deliveries and continues after malformed entries',async()=>{
 const ctx=context();ctx.fetch.mockResolvedValue(new Response('',{status:500}));await handleQuizSubmission(payload(),ctx);await ctx.outbox.set('broken','{');expect(await replayOutbox(ctx)).toEqual({sent:0,failed:2});ctx.fetch.mockResolvedValue(new Response('',{status:200}));expect(await replayOutbox(ctx)).toEqual({sent:1,failed:1});expect(ctx.outbox.data.size).toBe(1);
});
test('optin rejects invalid tokens and reports delivery failures honestly',async()=>{
 const ctx=context(),p=payload();const body={submissionId:p.submissionId,email:p.contact.email,token:'bad'};expect((await handleOptin(body,ctx)).status).toBe(403);expect(ctx.fetch).not.toHaveBeenCalled();body.token=signOptin(body.submissionId,body.email,env.OPTIN_SIGNING_KEY);expect((await handleOptin(body,ctx)).status).toBe(200);expect(JSON.parse(ctx.fetch.mock.calls[0][1]!.body as string)).toMatchObject({submissionId:p.submissionId,email:'jane@acme.org',optedInAt:expect.any(String)});ctx.fetch.mockRejectedValue(new Error('offline'));expect(await handleOptin(body,ctx)).toEqual({status:502,body:{ok:false}});
});
