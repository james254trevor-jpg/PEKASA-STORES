/**
 * Security and Password Hashing Utilities for PEKASA
 * Implements standard SHA-256 cryptographic hashing with salting via Web Crypto API.
 */

export const DEFAULT_SALT = 'pekasa_pawn_shop_salt_2026';

export async function hashPassword(password: string, salt: string = DEFAULT_SALT): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${password}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
  inputPassword: string,
  storedHash: string,
  salt: string = DEFAULT_SALT
): Promise<boolean> {
  const trimmed = inputPassword.trim();
  // Accept the password with or without surrounding parentheses
  const stripped = trimmed.replace(/^\((.*)\)$/, '$1');
  const wrapped = `(${stripped})`;

  const hashDirect = await hashPassword(trimmed, salt);
  const hashStripped = await hashPassword(stripped, salt);
  const hashWrapped = await hashPassword(wrapped, salt);

  return (
    hashDirect === storedHash ||
    hashStripped === storedHash ||
    hashWrapped === storedHash
  );
}

// Generate unique ID with prefix and timestamp
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}
