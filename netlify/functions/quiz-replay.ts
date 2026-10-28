// No schedule while paused. Leave quiz-outbox untouched for an explicit future review.
export default async (): Promise<Response> => Response.json({ ok: false, error: 'Quiz is paused.' }, { status: 410 });
export const config = {};
