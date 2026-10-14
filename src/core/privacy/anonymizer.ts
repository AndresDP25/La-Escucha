/**
 * Servicio de privacidad / anonimizacion.
 *
 * Contexto legal (Argentina): la Ley 25.326 de Proteccion de Datos Personales
 * considera a las opiniones politicas como DATOS SENSIBLES. Por eso aplicamos
 * dos niveles de tratamiento:
 *
 *  1) PSEUDONIMIZACION (comentarios comunes):
 *     El username se reemplaza por un hash HMAC-SHA256 estable
 *     (salt del tenant + pepper global). Permite agrupar "mismo autor" sin
 *     exponer la identidad, pero sigue siendo un dato personal tratado con
 *     cuidado.
 *
 *  2) ANONIMIZACION IRREVERSIBLE (comentarios sensibles / politicos):
 *     Se descarta por completo el username (no se guarda ni el hash) y se
 *     aplica un "scrubbing" de PII sobre el texto (telefonos, emails, DNI, @).
 *     El objetivo es que el dato quede fuera del alcance de la ley.
 */
import { createHmac } from 'node:crypto';
import { env } from '../../config/env';

/** Patrones de PII a remover del texto en el nivel de anonimizacion dura. */
const PII_PATTERNS: { label: string; regex: RegExp }[] = [
  // Emails
  { label: '[EMAIL]', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  // Telefonos (formatos AR flexibles: +54 9 11 1234-5678, etc.)
  {
    label: '[TEL]',
    regex: /(?:\+?54\s?)?(?:9\s?)?(?:11|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{4}/g,
  },
  // DNI / numeros largos (7-8 digitos, con o sin puntos)
  { label: '[ID]', regex: /\b\d{1,3}\.?\d{3}\.?\d{3}\b/g },
  // Menciones a terceros
  { label: '[USUARIO]', regex: /@[\w.]+/g },
];

/**
 * Pseudonimiza un username de red social de forma estable y por-tenant.
 * El mismo username dentro del mismo tenant produce siempre el mismo hash,
 * pero el valor no es reversible sin el pepper + salt.
 */
export function pseudonymizeAuthor(
  username: string,
  tenantSalt: string,
): string {
  return createHmac('sha256', `${tenantSalt}:${env.ANONYMIZATION_PEPPER}`)
    .update(username.trim().toLowerCase())
    .digest('hex');
}

/**
 * Remueve informacion de identificacion personal (PII) de un texto libre.
 * Se usa sobre comentarios sensibles antes de persistirlos.
 */
export function scrubPII(text: string): string {
  let result = text;
  for (const { label, regex } of PII_PATTERNS) {
    result = result.replace(regex, label);
  }
  return result.replace(/\s+/g, ' ').trim();
}

/** Resultado de aplicar la politica de privacidad a un comentario. */
export interface AnonymizationResult {
  /** Hash del autor, o null si se anonimizo de forma irreversible. */
  authorHash: string | null;
  /** Texto original a persistir, o null si se descarto por sensible. */
  rawText: string | null;
  /** Texto limpio final (con PII removida si corresponde). */
  cleanText: string;
  isAnonymized: boolean;
}

/**
 * Aplica la politica de privacidad segun si el comentario es sensible.
 *
 * @param params.username   Username original del autor en la red.
 * @param params.rawText     Texto original del comentario.
 * @param params.cleanText   Texto ya normalizado/limpio.
 * @param params.tenantSalt  Sal del tenant para pseudonimizar.
 * @param params.isSensitive Si el comentario fue clasificado como sensible.
 */
export function applyPrivacyPolicy(params: {
  username: string | null;
  rawText: string;
  cleanText: string;
  tenantSalt: string;
  isSensitive: boolean;
}): AnonymizationResult {
  const { username, rawText, cleanText, tenantSalt, isSensitive } = params;

  if (isSensitive) {
    // Anonimizacion irreversible: sin autor, sin texto original, PII removida.
    return {
      authorHash: null,
      rawText: null,
      cleanText: scrubPII(cleanText),
      isAnonymized: true,
    };
  }

  // Pseudonimizacion: se conserva el texto y un hash estable del autor.
  return {
    authorHash: username ? pseudonymizeAuthor(username, tenantSalt) : null,
    rawText,
    cleanText,
    isAnonymized: false,
  };
}
