// New course opt-ins are paused; existing contacts and consent records are retained.
export default async (_request: Request): Promise<Response> => Response.json(
  { ok: false, error: 'Quiz is paused.' },
  { status: 410, headers: { 'Cache-Control': 'no-store' } },
);
export const config = { path: '/api/optin' };
