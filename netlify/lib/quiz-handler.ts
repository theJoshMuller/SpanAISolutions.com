import type { SubmissionPayload } from '../../src/quiz/api';
import { scoreAll, validateAnswers, type QuizResult } from '../../src/quiz/scoring';
import { normalizeEmail, signOptin, verifyOptin } from './token';
export interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
  delete(k: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
export interface QuizEnv {
  N8N_QUIZ_WEBHOOK_URL: string;
  N8N_OPTIN_WEBHOOK_URL: string;
  N8N_QUIZ_SECRET: string;
  OPTIN_SIGNING_KEY: string;
  CONTEXT: string;
}
export interface Envelope extends Omit<SubmissionPayload, 'website'> {
  result: QuizResult;
  optinToken: string;
  test: boolean;
  receivedAt: string;
}
type DeliveryContext = { env: QuizEnv; fetch: typeof fetch };
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const emailValid = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
// Promise.race bounds even a transport that ignores AbortSignal. Clearing the
// watchdog avoids leaving timers behind after a quick successful delivery.
async function forward(url: string, body: unknown, ctx: DeliveryContext): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!url || !ctx.env.N8N_QUIZ_SECRET) return false;
    const deadline = new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 4000); });
    const delivery = Promise.resolve().then(() => ctx.fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Span-Quiz-Secret': ctx.env.N8N_QUIZ_SECRET },
      body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
    })).then(response => response.ok, () => false);
    return await Promise.race([delivery, deadline]);
  } finally { clearTimeout(timer); }
}
export async function handleQuizSubmission(body: unknown, ctx: DeliveryContext & { ip: string; now: number; outbox: KV; rate: KV }): Promise<{status: number; body: {ok: boolean; optinToken?: string; errors?: string[]}}> {
  const invalid = (errors: string[]) => ({ status: 400, body: {ok: false, errors} });
  if (!object(body)) return invalid(['Submission must be an object.']);
  if (typeof body.website === 'string' && body.website.length > 0) return {status:202,body:{ok:true}};
  const started = typeof body.startedAt === 'string' ? Date.parse(body.startedAt) : NaN;
  if (!Number.isFinite(started)) return invalid(['Invalid start time.']);
  if (ctx.now - started < 20000) return {status:202,body:{ok:true}};
  const validated = validateAnswers(body.answers);
  const errors = validated.ok ? [] : [...validated.errors];
  if (!uuid(body.submissionId)) errors.push('Invalid submission ID.');
  if (typeof body.website !== 'string') errors.push('Invalid honeypot.');
  const contact = object(body.contact) ? body.contact : {};
  const text = (v:unknown, max:number, required=false): string | null => {
    if (v === null && !required) return null;
    if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) { errors.push('Invalid contact field.'); return null; }
    return v.trim() || null;
  };
  const firstName = text(contact.firstName,80,true);
  const email = typeof contact.email === 'string' ? normalizeEmail(contact.email) : '';
  if (!emailValid(email)) errors.push('Invalid email.');
  const organization = text(contact.organization,120);
  const phone = text(contact.phone,40);
  const attr = object(body.attribution) ? body.attribution : {};
  const attribution: SubmissionPayload['attribution'] = {utm_source:null,utm_medium:null,utm_campaign:null,referrer:null,landingPath:''};
  for (const key of Object.keys(attribution) as (keyof typeof attribution)[]) {
    const value = attr[key];
    if (typeof value === 'string' && value.length <= 2048) attribution[key] = value;
    else if (value !== null || key === 'landingPath') errors.push('Invalid attribution.');
  }
  if (errors.length || !validated.ok || !uuid(body.submissionId)) return invalid(errors);
  const hour = new Date(ctx.now).toISOString().slice(0,13).replace(/[-T:]/g,'');
  const rateKey = `${ctx.ip}:${hour}`;
  const count = Number(await ctx.rate.get(rateKey) ?? '0');
  if (count >= 5) return {status:429,body:{ok:false}};
  await ctx.rate.set(rateKey,String(count+1));
  const result = scoreAll(validated.answers);
  const optinToken = signOptin(body.submissionId,email,ctx.env.OPTIN_SIGNING_KEY);
  const envelope: Envelope = {
    submissionId:body.submissionId,startedAt:new Date(started).toISOString(),answers:validated.answers,
    contact:{firstName:firstName!,email,organization:result.path === 'leader' ? organization : null,phone:result.segment === 'discovery' ? phone : null},
    attribution,result,optinToken,test:ctx.env.CONTEXT !== 'production' || email.split('@')[0].includes('+quiztest'),receivedAt:new Date(ctx.now).toISOString(),
  };
  if (!await forward(ctx.env.N8N_QUIZ_WEBHOOK_URL,envelope,ctx)) await ctx.outbox.set(envelope.submissionId,JSON.stringify(envelope));
  return {status:200,body:{ok:true,optinToken}};
}
export async function handleOptin(body:unknown,ctx:DeliveryContext): Promise<{status:number;body:{ok:boolean}}> {
  if (!object(body) || !uuid(body.submissionId) || typeof body.email !== 'string' || !emailValid(normalizeEmail(body.email)) || typeof body.token !== 'string' || !verifyOptin(body.submissionId,body.email,body.token,ctx.env.OPTIN_SIGNING_KEY)) return {status:403,body:{ok:false}};
  const ok = await forward(ctx.env.N8N_OPTIN_WEBHOOK_URL,{submissionId:body.submissionId,email:normalizeEmail(body.email),optedInAt:new Date().toISOString()},ctx);
  return {status:ok ? 200 : 502,body:{ok}};
}
export async function replayOutbox(ctx:DeliveryContext & {outbox:KV}):Promise<{sent:number;failed:number}> {
  let sent=0,failed=0;
  for(const key of await ctx.outbox.list('')) {
    try {
      const raw=await ctx.outbox.get(key);
      if(raw === null) continue;
      if(await forward(ctx.env.N8N_QUIZ_WEBHOOK_URL,JSON.parse(raw),ctx)) {await ctx.outbox.delete(key);sent++;} else failed++;
    } catch {failed++;}
  }
  return {sent,failed};
}
