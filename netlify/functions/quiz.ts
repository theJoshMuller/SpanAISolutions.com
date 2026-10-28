import type { Context } from '@netlify/functions';
import { handleQuizSubmission } from '../lib/quiz-handler';
import { environment, store } from '../lib/runtime';
export default async (request: Request, context: Context): Promise<Response> => {
  if (request.method !== 'POST') return Response.json({ok:false}, {status:405,headers:{Allow:'POST'}});
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ok:false,errors:['Invalid JSON.']},{status:400}); }
  try {
    const result = await handleQuizSubmission(body,{ip:context.ip,now:Date.now(),env:environment(),fetch,outbox:store('quiz-outbox'),rate:store('quiz-rate')});
    return Response.json(result.body,{status:result.status});
  } catch { return Response.json({ok:false},{status:503}); }
};
export const config = { path: '/api/quiz' };
