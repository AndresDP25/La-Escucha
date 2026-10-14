/**
 * Factory que decide que implementacion de `Classifier` usar.
 *
 * Hoy devuelve siempre el clasificador por keywords. Cuando se implemente el
 * `LLMClassifier`, aca se seleccionara segun `env.LLM_PROVIDER` sin tocar el
 * pipeline de procesamiento.
 */
import type { KeywordConfig } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { KeywordClassifier } from './keyword-classifier';
import type { Classifier } from './classifier.types';

/**
 * Construye el clasificador apropiado para un tenant a partir de sus keywords.
 */
export function createClassifier(keywords: KeywordConfig[]): Classifier {
  switch (env.LLM_PROVIDER) {
    case 'openai':
      // TODO (Fase 3): implementar LLMClassifier (OpenAI/Claude) y devolverlo.
      // Mientras no exista, caemos al clasificador por diccionario.
      logger.warn(
        'LLM_PROVIDER=openai pero LLMClassifier no esta implementado; usando KeywordClassifier',
      );
      return new KeywordClassifier(keywords);
    case 'mock':
    default:
      return new KeywordClassifier(keywords);
  }
}
