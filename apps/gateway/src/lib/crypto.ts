import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password using Node's native scrypt with a random 16-byte salt.
 * Stored format: `<hex_salt>:<hex_derived_key>`
 */
export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored `<hex_salt>:<hex_derived_key>` hash
 * using constant-time comparison (`timingSafeEqual`) to prevent timing side-channel attacks.
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) {
    return false;
  }
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH);
  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(keyBuffer, derivedKey);
}
