import {describe,it,expect}from'vitest';
// @ts-ignore import-free runtime helpers
import {noteClaimPayload,verifyClaim,personPatch,richText,taskPayload,routeRecipient,researchMarkdown}from'../../n8n/src/workflow.js';
const env={submissionId:'12345678-1234-4234-8234-123456789012',receivedAt:'2026-10-27T12:00:00.000Z',test:true,answers:{A1:'owner',C1:'<script>reports',C4:'more time',D2:'hello'},contact:{firstName:'Jane',email:'jane@acme.org',organization:'Acme'},result:{segment:'discovery',aiLevel:60,dollarsPerYear:12300}};
describe('quiz workflow guarantees',()=>{
 it('claims the existing unique Note UUID before allowing an alert, fails closed on conflicts or malformed success',()=>{expect(noteClaimPayload(env,{title:'title',markdown:'body'}).variables.data.id).toBe(env.submissionId);expect(verifyClaim({data:{createNote:{id:env.submissionId}}},env.submissionId)).toBe(true);expect(verifyClaim({errors:[{message:'duplicate key'}]},env.submissionId)).toBe(false);expect(verifyClaim({data:{createNote:{id:'other'}}},env.submissionId)).toBe(false);});
 it('never resets existing lead status and maps enum/currency/role',()=>{expect(personPatch(env,false)).not.toHaveProperty('leadStatus');expect(personPatch(env,true)).toMatchObject({leadStatus:'NEW',segment:'DISCOVERY',leadSource:'QUIZ',jobTitle:'Owner / founder',estAnnualValue:{amountMicros:12300000000,currencyCode:'CAD'}});});
 it('builds UI-visible note bodies and due tasks with escaped free text',()=>{expect(richText('a\nb').markdown).toBe('a\nb');expect(JSON.parse(richText('a\nb').blocknote)).toHaveLength(2);const task=taskPayload(env,'kami');expect(task.dueAt).toBe('2026-10-27T13:00:00.000Z');expect(task.bodyV2.markdown).not.toContain('<script>');});
 it('routes every test message to Josh, and limits safe research to five bullets',()=>{expect(routeRecipient(env,'jane@acme.org')).toBe('josh@spanaisolutions.com');expect(routeRecipient({...env,test:false},'jane@acme.org')).toBe('jane@acme.org');const text=researchMarkdown({results:Array.from({length:8},()=>({title:'<script>',content:'"hello"',url:'javascript:alert(1)'}))});expect(text.match(/^- /gm)).toHaveLength(5);expect(text).not.toContain('<script>');expect(text).not.toContain('javascript:');});
});

describe('atomic dedupe under overlapping deliveries',()=>{
 it('allows one Note and one alert across overlap and later replay',async()=>{
  const notes=new Map();let alerts=0;
  async function receive(){const payload=noteClaimPayload(env,{title:env.submissionId,markdown:'body'});await Promise.resolve();const id=payload.variables.data.id;const response=notes.has(id)?{errors:[{message:'duplicate key'}]}:(notes.set(id,payload.variables.data),{data:{createNote:{id}}});if(verifyClaim(response,id))alerts++;}
  await Promise.all(Array.from({length:25},receive));await receive();expect(notes.size).toBe(1);expect(alerts).toBe(1);
 });
});
