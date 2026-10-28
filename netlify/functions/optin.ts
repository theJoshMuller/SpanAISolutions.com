import { handleOptin } from '../lib/quiz-handler';
import { environment } from '../lib/runtime';
export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return Response.json({ok:false}, {status:405,headers:{Allow:'POST'}});
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ok:false},{status:400}); }
  try {
    const result = await handleOptin(body,{env:environment(),fetch});
    return Response.json(result.body,{status:result.status});
  } catch { return Response.json({ok:false},{status:503}); }
};
export const config = { path: '/api/optin' };
