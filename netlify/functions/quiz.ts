import type { Config } from '@netlify/functions';

// Quiz paused until the course is ready. Restore the active wrapper from 77eb988.
export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/quiz')) {
    // Netlify forwards incoming query strings unless the destination supplies its own.
    const location = url.search ? '/?quiz=paused' : '/';
    return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
  }
  return Response.json({ ok: false, error: 'Quiz is paused.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
};
export const config: Config = { path: ['/api/quiz', '/quiz', '/quiz/*'], preferStatic: true };
