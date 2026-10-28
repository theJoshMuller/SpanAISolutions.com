import {describe,it,expect} from 'vitest';
// @ts-ignore Node built-in runtime
import {readFile} from 'node:fs/promises';
// @ts-ignore deployment module
import {resolveWorkflow} from '../../scripts/n8n_deploy.mjs';

// Offline dataflow harness: external nodes are stubs, while the terminal Code
// node runs verbatim. Inject n8n's documented Continue output {error: message}.
async function simulate(failed:string[],research:boolean) {
 const w=await resolveWorkflow(JSON.parse(await readFile('n8n/span-quiz-intake.json','utf8')));
 const outputs=new Map<string,any[]>();const attempted:string[]=[];
 let name='Find Person';let failure:Error|undefined;
 const branch:Record<string,boolean>={'Company needed':true,'Person available':true,'Discovery task needed':true,'Company research needed':research};
 for(let count=0;name&&count<100;count++){
  const n=w.nodes.find((n:any)=>n.name===name);attempted.push(name);
  if(name==='Report deferred failures'){
   const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
   const $=(key:string)=>({isExecuted:outputs.has(key),all:()=>outputs.get(key),first:()=>({json:{env:{submissionId:'test-submission'}}})});
   try{await new AsyncFunction('$','$input',n.parameters.jsCode)($,{all:()=>[{json:{}}]});}catch(e){failure=e as Error;}
   break;
  }
  outputs.set(name,[{json:failed.includes(name)?{error:'injected failure'}:{ok:true}}]);
  if(failed.includes(name)&&n.onError!=='continueRegularOutput')break;
  const index=n.type==='n8n-nodes-base.if'?(branch[name]?0:1):0;
  name=w.connections[name]?.main[index]?.[0]?.node;
 }
 return {w,attempted,failure};
}
describe('deferred post-alert failures',()=>{
 it.each(['Upsert Person','Send result email'])('continues downstream after %s then fails for the existing Josh error workflow',async(step)=>{
  const {attempted,failure}=await simulate([step],true);
  expect(attempted).toContain('Send result email');
  expect(attempted).toContain('Update submission Note');
  expect(failure?.message).toContain(step);
  expect(failure?.message).toContain('test-submission');
  const errors=JSON.parse(await readFile('n8n/span-quiz-errors.json','utf8'));
  const deploy=await readFile('scripts/n8n_deploy.mjs','utf8');
  expect(deploy).toContain("w.settings.errorWorkflow=owned['Span · Quiz Errors']");
  expect(errors.nodes.find((n:any)=>n.name==='Build error MIME').parameters.jsCode).toContain("to:'josh@spanaisolutions.com'");
 });
 it('reports all failures on the no-research branch and succeeds for skipped/successful steps',async()=>{
  const failed=await simulate(['Find Person','Send result email'],false);
  expect(failed.failure?.message).toContain('Find Person');expect(failed.failure?.message).toContain('Send result email');
  const ok=await simulate([],false);expect(ok.attempted).toContain('Report deferred failures');expect(ok.failure).toBeUndefined();
 });
});
