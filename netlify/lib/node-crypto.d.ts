// Narrow declarations for the Node APIs used here. This project deliberately
// limits new dev dependencies to @netlify/functions and has no @types/node.
declare module 'node:crypto' {
  interface Hmac {
    update(data: string): Hmac;
    digest(encoding: 'hex'): string;
  }
  export function createHmac(algorithm: 'sha256', key: string): Hmac;
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}
