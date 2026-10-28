import type { Config } from '@netlify/functions';

// Quiz paused until the course is ready. Restore the active wrapper from 77eb988.
export default async (request: Request): Promise<Response> => {
  if (new URL(request.url).pathname.startsWith('/quiz')) {
    // Do not forward old opt-in email addresses or signed tokens into the home URL.
    return new Response(null, { status: 302, headers: { Location: '/', 'Cache-Control': 'no-store' } });
  }
  return Response.json({ ok: false, error: 'Quiz is paused.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
};
export const config: Config = { path: ['/api/quiz', '/quiz', '/quiz/*'] };
