import 'server-only';

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
const VERIFICATION_TTL_MS = 30 * 60 * 1000;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: MAX_MEMORY,
    }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string | null) {
  if (!encoded || encoded.length > 160) return false;
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, keyRaw, ...extra] = encoded.split('$');
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (
    algorithm !== 'scrypt' || extra.length > 0 || n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P ||
    !saltRaw || !keyRaw || !/^[A-Za-z0-9_-]+$/.test(saltRaw) || !/^[A-Za-z0-9_-]+$/.test(keyRaw)
  ) return false;

  try {
    const salt = Buffer.from(saltRaw, 'base64url');
    const expected = Buffer.from(keyRaw, 'base64url');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await deriveKey(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createVerificationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashVerificationToken(token), expires: new Date(Date.now() + VERIFICATION_TTL_MS) };
}

export function hashVerificationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function verificationUrl(token: string) {
  const configuredBase = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM || !configuredBase)) {
    throw new Error('EMAIL_VERIFICATION_CONFIGURATION_REQUIRED');
  }
  const base = configuredBase ?? 'http://localhost:3000';
  const url = new URL(`/verificar-email?token=${encodeURIComponent(token)}`, base);
  if (!['http:', 'https:'].includes(url.protocol) || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
    throw new Error('EMAIL_VERIFICATION_URL_INVALID');
  }
  return url.toString();
}

export async function sendVerificationEmail(email: string, name: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'development') return false;
    throw new Error('EMAIL_VERIFICATION_CONFIGURATION_REQUIRED');
  }

  const safeName = name.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Verificá tu correo de Territorio',
      html: `<p>Hola ${safeName},</p><p>Confirmá tu correo para activar tu cuenta.</p><p><a href="${url}">Verificar correo</a></p><p>El enlace vence en 30 minutos.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('VERIFICATION_EMAIL_SEND_FAILED');
  return true;
}
