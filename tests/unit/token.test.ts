import { expect, test } from 'vitest';
import { normalizeEmail, signOptin, verifyOptin } from '../../netlify/lib/token';
test('normalizes email before signing and verifies only intact tokens', () => {
  expect(normalizeEmail(' Jane@Acme.ORG ')).toBe('jane@acme.org');
  const token = signOptin('id', ' Jane@Acme.ORG ', 'key');
  expect(token).toBe(signOptin('id', 'jane@acme.org', 'key'));
  expect(verifyOptin('id', 'jane@acme.org', token, 'key')).toBe(true);
  for (const bad of ['x', token.slice(2), 'z'.repeat(64), token + '00']) expect(verifyOptin('id', 'jane@acme.org', bad, 'key')).toBe(false);
  expect(verifyOptin('other', 'jane@acme.org', token, 'key')).toBe(false);
});
