import { describe, it, expect } from 'vitest';
// @ts-ignore Node-only operator script.
import { buildEnvelopes, cleanupPlan, listAll, verifyRecords } from '../../scripts/quiz_live_test.mjs';
describe('offline live-test operator',()=>{
 it('uses real scoring and signatures for all three marked personas',async()=>{const rows=await buildEnvelopes('offline-key');expect(rows.map((x:any)=>x.result.segment)).toEqual(['discovery','nurture-leader','course']);for(const e of rows){expect(e.test).toBe(true);expect(e.optinToken).toMatch(/^[a-f0-9]{64}$/);expect(e.contact.email).toContain('+quiztest-');expect(e.contact.firstName).toContain('quiztest');}});
 it('paginates using documented top-level pageInfo',async()=>{const calls:any[]=[];const rows=await listAll(async(_m:any,p:any)=>{calls.push(p);return calls.length===1?{data:{people:[{id:'a'}]},pageInfo:{hasNextPage:true,endCursor:'cursor'}}:{data:{people:[{id:'b'}]},pageInfo:{hasNextPage:false}};},'people');expect(rows).toHaveLength(2);expect(calls[1]).toContain('starting_after=cursor');});
 it('removes linked notes and targets before marked records, preserves real records',()=>{const db={people:[{id:'p',emails:{primaryEmail:'josh+quiztest-discovery-123@spanaisolutions.com'}}],companies:[{id:'c',name:'quiztest-123'}],notes:[{id:'n',title:'UUID only',bodyV2:{markdown:'quiztest-123'}}],tasks:[{id:'t',title:'Call quiztest-123'}],noteTargets:[{id:'nt',noteId:'n',targetPersonId:'p'}],taskTargets:[{id:'tt',taskId:'t',targetPersonId:'p'}]};expect(cleanupPlan(db).map((x:any)=>x.collection)).toEqual(['noteTargets','taskTargets','notes','tasks','people','companies']);expect(()=>cleanupPlan({...db,notes:[{id:'n',title:'Real note'}]})).toThrow(/unmarked/i);});
 it('fails closed on malformed pagination',async()=>{await expect(listAll(async()=>({data:{people:[]},pageInfo:{hasNextPage:true}}),'people')).rejects.toThrow();});
 it('requires exactly one note per UUID and correct consent/task',async()=>{const [e]=await buildEnvelopes('key');const db={people:[{id:'p',emails:{primaryEmail:e.contact.email},segment:'DISCOVERY',aiLevel:e.result.aiLevel,leadStatus:'NEW',courseOptIn:true}],notes:[{title:e.submissionId}],tasks:[{id:'t',assigneeId:'b5eee740-b5e0-40ba-9d82-1eba46e08899'}],taskTargets:[{taskId:'t',targetPersonId:'p'}]};expect(()=>verifyRecords([e],db,true)).not.toThrow();expect(()=>verifyRecords([e],{...db,notes:[...db.notes,...db.notes]},true)).toThrow();});
});
it('dry-run including cleanup never calls the network',async()=>{
 // @ts-ignore Node-only operator script.
 const {main}=await import('../../scripts/quiz_live_test.mjs');
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network forbidden');};
 try{await main(['--dry-run','--cleanup']);}finally{globalThis.fetch=original;}
});
it('includes orphan association targets linked to marked People',()=>{
 const db={people:[{id:'p',emails:{primaryEmail:'josh+quiztest-course-123@spanaisolutions.com'}}],companies:[],notes:[],tasks:[],noteTargets:[{id:'orphan',noteId:'gone',targetPersonId:'p'}],taskTargets:[]};
 expect(cleanupPlan(db).map((r:any)=>r.id)).toEqual(['orphan','p']);
});
