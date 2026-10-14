/**
 * Contratos del subsistema de clasificacion.
 *
 * Patron Strategy: el pipeline depende de la interfaz `Classifier`, no de una
 * implementacion concreta. Hoy existe `KeywordClassifier` (diccionario/regex);
 * manana puede sumarse `LLMClassifier` (OpenAI/Claude) sin cambiar el pipeline.
 */
import type { Category, Sentiment } from '@prisma/client';

/** Texto de entrada ya procesado para clasificar. */
export interface ClassificationInput {
  /** Texto normalizado (minusculas, sin acentos ni emojis). */
  normalizedText: string;
  /** Texto limpio (sin stop-words). */
  cleanText: string;
}

/** Resultado de la clasificacion de un comentario. */
export interface ClassificationResult {
  category: Category;
  sentiment: Sentiment;
  /** Si el contenido es sensible (p. ej. politico) y requiere anonimizacion. */
  isSensitive: boolean;
}

/** Interfaz que todo clasificador debe implementar. */
export interface Classifier {
  classify(input: ClassificationInput): Promise<ClassificationResult>;
}
