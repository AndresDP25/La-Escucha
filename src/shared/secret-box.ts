/**
 * Cifra textos cortos (la clave de Apify) para guardarlos en la base.
 * La clave sale de JWT_SECRET y no se escribe en el disco.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env';

function key(): Buffer {
  return createHash('sha256').update(env.JWT_SECRET).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((part) => part.toString('base64url')).join('.');
}

export function openSecret(sealed: string): string {
  const [iv, tag, data] = sealed.split('.');
  if (!iv || !tag || !data) throw new Error('Secreto ilegible');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
