import { createHmac, timingSafeEqual } from 'node:crypto';
export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function signOptin(submissionId: string, email: string, key: string): string {
  if (!key) throw new Error('Missing opt-in signing key');
  return createHmac('sha256', key).update(`${submissionId}:${normalizeEmail(email)}`).digest('hex');
}
export function verifyOptin(submissionId: string, email: string, token: string, key: string): boolean {
  if (!key || !/^[a-f0-9]{64}$/i.test(token)) return false;
  return timingSafeEqual(new TextEncoder().encode(token.toLowerCase()), new TextEncoder().encode(signOptin(submissionId, email, key)));
}
