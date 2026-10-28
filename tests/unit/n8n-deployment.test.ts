import {describe,it,expect,vi} from 'vitest';
// @ts-ignore Node built-in available in Vitest runtime.
import {readFile} from 'node:fs/promises';
// @ts-ignore Node-only deployment scripts are tested directly.
import {QUIZ_FIELDS,ensureQuizFields} from '../../scripts/twenty_quiz_fields.mjs';
// @ts-ignore
import {resolveWorkflow,selectWorkflowTarget} from '../../scripts/n8n_deploy.mjs';
describe('Twenty quiz schema setup',()=>{
 it('creates only seven planned Person fields and skips all on repeat',async()=>{
  const person={id:'person',nameSingular:'person',fields:[] as any[]};const request=vi.fn(async(method:string,_path:string,body:any)=>{if(method==='GET')return {data:[person],pageInfo:{hasNextPage:false}};person.fields.push(body);return {data:{createOneField:body}};});
  const log=vi.fn();await ensureQuizFields(request,log);expect(person.fields.map(f=>f.name)).toEqual(QUIZ_FIELDS.map((f:any)=>f.name));expect(person.fields.every(f=>f.objectMetadataId==='person')).toBe(true);request.mockClear();await ensureQuizFields(request,log);expect(request.mock.calls.every(([method])=>method==='GET')).toBe(true);expect(log.mock.calls.filter(([v])=>v.startsWith('skipped')).length).toBe(7);
 });
 it('fails closed on incompatible existing fields before any writes',async()=>{const request=vi.fn(async()=>({data:[{id:'p',nameSingular:'person',fields:[{name:'segment',type:'TEXT'}]}],pageInfo:{hasNextPage:false}}));await expect(ensureQuizFields(request,()=>{})).rejects.toThrow(/segment/);expect(request).toHaveBeenCalledTimes(1);});
});
describe('safe workflow deployment',()=>{
 it('resolves import-free module includes and rejects unknown includes',async()=>{const r=await resolveWorkflow({name:'x',nodes:[{parameters:{jsCode:'/*@include mime.js*/\nreturn buildRawMime;' }}]});expect(r.nodes[0].parameters.jsCode).toContain('function buildRawMime');expect(r.nodes[0].parameters.jsCode).not.toMatch(/export |@include/);await expect(resolveWorkflow({nodes:[{parameters:{jsCode:'/*@include ../oops.js*/'}}]})).rejects.toThrow();});
 it('never updates an arbitrary colliding workflow name or active workflow',()=>{expect(()=>selectWorkflowTarget([{id:'old',name:'quiz',active:false}],'quiz',{})).toThrow(/collision/);expect(selectWorkflowTarget([{id:'own',name:'quiz',active:false}],'quiz',{quiz:'own'})).toBe('own');expect(()=>selectWorkflowTarget([{id:'own',name:'quiz',active:true}],'quiz',{quiz:'own'})).toThrow(/active/);expect(selectWorkflowTarget([],'quiz',{})).toBe(null);});
});

describe('authored workflow validation',()=>{
 it('compiles every resolved Code node and connects only existing nodes',async()=>{
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  for(const file of ['intake','optin','errors']){const w=await resolveWorkflow(JSON.parse(await readFile(`n8n/span-quiz-${file}.json`,'utf8')));const names=new Set(w.nodes.map((n:any)=>n.name));const checkExpressions=(value:any):void=>{if(typeof value==='string'&&value.startsWith('={{')&&value.endsWith('}}'))expect(()=>new Function('return ('+value.slice(3,-2)+')')).not.toThrow();else if(value&&typeof value==='object')Object.values(value).forEach(checkExpressions);};checkExpressions(w);for(const n of w.nodes){if(n.type==='n8n-nodes-base.code')expect(()=>new AsyncFunction(n.parameters.jsCode)).not.toThrow();if(n.type==='n8n-nodes-base.webhook'){expect(n.parameters.authentication).toBe('headerAuth');expect(n.credentials.httpHeaderAuth.name).toBe('Span Quiz Webhook Secret');}}for(const [name,outputs]of Object.entries(w.connections) as any){expect(names.has(name)).toBe(true);for(const branch of outputs.main)for(const edge of branch||[])expect(names.has(edge.node)).toBe(true);}}
 });
});
