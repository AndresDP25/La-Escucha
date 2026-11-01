/**
 * Analisis de sentimiento MOCK basado en diccionario.
 *
 * Es deliberadamente simple: cuenta coincidencias de palabras positivas y
 * negativas sobre el texto normalizado. Sirve como placeholder hasta integrar
 * un LLM, que rinde mucho mejor con el espanol rioplatense (ironia, modismos).
 */
import type { Sentiment } from '@prisma/client';

const POSITIVE_WORDS = new Set([
  'gracias', 'excelente', 'buenisimo', 'genial', 'felicitaciones', 'bien',
  'bueno', 'buena', 'mejor', 'hermoso', 'barbaro', 'copado', 'perfecto',
  'agradezco', 'resuelto', 'solucionado', 'rapido', 'amable',
  'ojala', 'fuerza',
]);

const NEGATIVE_WORDS = new Set([
  'pesimo', 'malo', 'mala', 'horrible', 'desastre', 'verguenza', 'basura',
  'nunca', 'inseguro', 'inseguridad', 'robo', 'robaron', 'peligro', 'peligroso',
  'roto', 'rota', 'abandonado', 'sucio', 'demora', 'lento', 'reclamo', 'queja',
  'bronca', 'indignante', 'corrupto', 'mentira', 'no funciona',
  'decepcion', 'fraude', 'dictadura', 'dictatorial', 'traicion', 'infeliz',
  'tibieza',
]);

/** Analiza el sentimiento de un texto normalizado. */
export function analyzeSentiment(normalizedText: string): Sentiment {
  const tokens = normalizedText.split(' ');
  let score = 0;

  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) score += 1;
    if (NEGATIVE_WORDS.has(token)) score -= 1;
  }

  // Frases negativas compuestas.
  if (normalizedText.includes('no funciona')) score -= 1;

  if (score > 0) return 'POSITIVE';
  if (score < 0) return 'NEGATIVE';
  return 'NEUTRAL';
}
