/**
 * Verificacion de la firma HMAC de los webhooks.
 *
 * El proveedor (o nuestro proxy) debe firmar el cuerpo crudo del request con el
 * `webhookSecret` del tenant (HMAC-SHA256) y enviarlo en el header configurado.
 * Comparamos en tiempo constante para evitar ataques de temporizacion.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Header donde se espera la firma. */
export const SIGNATURE_HEADER = 'x-signature';

/**
 * Verifica que `signature` corresponda al HMAC-SHA256 de `rawBody` usando
 * `secret`. Acepta la firma en hex, con o sin prefijo "sha256=".
 */
export function verifySignature(
  rawBody: Buffer,
  secret: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;

  const provided = signature.replace(/^sha256=/, '').trim();
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  // Deben tener la misma longitud para usar timingSafeEqual.
  const providedBuf = Buffer.from(provided, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
