/**
 * Utilidades de limpieza y normalizacion de texto para los comentarios.
 *
 * Flujo tipico:
 *   1. extractEmojis()  -> aisla los emojis del texto original.
 *   2. normalizeText()  -> minusculas, sin acentos, sin emojis, sin signos.
 *   3. cleanText()      -> normaliza y remueve stop-words.
 *
 * `normalizeText()` tambien se usa para comparar contra el diccionario de
 * keywords, de modo que "Bache!" matchee con el patron literal "bache".
 */
import { SPANISH_STOPWORDS } from './stopwords.es';

/**
 * Expresion para detectar la mayoria de los emojis (planos astrales Unicode).
 * Usamos la propiedad Unicode Extended_Pictographic.
 */
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

/** Resultado del procesamiento de un texto. */
export interface ProcessedText {
  /** Emojis aislados, en orden de aparicion (con repeticiones). */
  emojis: string[];
  /** Texto normalizado completo (incluye stop-words). */
  normalized: string;
  /** Texto limpio: normalizado y sin stop-words. */
  clean: string;
}

/** Extrae los emojis presentes en un texto. */
export function extractEmojis(text: string): string[] {
  const matches = text.match(EMOJI_REGEX);
  return matches ? [...matches] : [];
}

/**
 * Normaliza un texto para analisis y comparacion:
 *  - pasa a minusculas,
 *  - remueve acentos/diacriticos,
 *  - elimina emojis, URLs y menciones/hashtags,
 *  - colapsa signos de puntuacion y espacios.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Separar diacriticos y removerlos (NFD + rango combinante).
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Quitar URLs.
    .replace(/https?:\/\/\S+/g, ' ')
    // Quitar menciones y hashtags (se conservan como targets, no como texto).
    .replace(/[@#][\w.]+/g, ' ')
    // Quitar emojis.
    .replace(EMOJI_REGEX, ' ')
    // Reemplazar todo lo que no sea letra/numero/espacio por espacio.
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    // Colapsar espacios.
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokeniza un texto normalizado y remueve stop-words. */
export function removeStopwords(normalized: string): string[] {
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter((token) => token.length > 1 && !SPANISH_STOPWORDS.has(token));
}

/** Procesa un comentario completo: emojis + normalizado + texto limpio. */
export function processText(text: string): ProcessedText {
  const emojis = extractEmojis(text);
  const normalized = normalizeText(text);
  const clean = removeStopwords(normalized).join(' ');
  return { emojis, normalized, clean };
}
