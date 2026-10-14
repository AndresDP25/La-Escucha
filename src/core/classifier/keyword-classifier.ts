/**
 * Clasificador por diccionario/regex, parametrizable por municipio.
 *
 * Recibe las `KeywordConfig` del tenant y determina la categoria tematica de un
 * comentario sumando el `weight` de las keywords que coinciden. La categoria con
 * mayor puntaje gana; ante empate o sin coincidencias, cae en OTHER.
 *
 * El sentimiento se delega al analizador mock. La sensibilidad se marca cuando
 * la categoria resultante es POLITICS (contenido politico = dato sensible).
 */
import type { Category, KeywordConfig } from '@prisma/client';
import { logger } from '../../config/logger';
import { analyzeSentiment } from './sentiment';
import type {
  Classifier,
  ClassificationInput,
  ClassificationResult,
} from './classifier.types';

export class KeywordClassifier implements Classifier {
  /** Keywords activas del tenant, precompiladas. */
  private readonly rules: {
    category: Category;
    weight: number;
    test: (normalizedText: string) => boolean;
  }[];

  constructor(keywords: KeywordConfig[]) {
    this.rules = keywords
      .filter((kw) => kw.isActive)
      .map((kw) => {
        if (kw.matchType === 'REGEX') {
          try {
            const regex = new RegExp(kw.pattern, 'i');
            return {
              category: kw.category,
              weight: kw.weight,
              test: (text: string) => regex.test(text),
            };
          } catch {
            logger.warn(
              { pattern: kw.pattern, tenantKeyword: kw.id },
              'Regex de keyword invalida; se ignora',
            );
            return null;
          }
        }
        // LITERAL: comparacion por substring sobre el texto normalizado.
        const needle = kw.pattern.toLowerCase().trim();
        return {
          category: kw.category,
          weight: kw.weight,
          test: (text: string) => text.includes(needle),
        };
      })
      .filter((rule): rule is NonNullable<typeof rule> => rule !== null);
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const { normalizedText } = input;

    // Acumular puntaje por categoria.
    const scores = new Map<Category, number>();
    for (const rule of this.rules) {
      if (rule.test(normalizedText)) {
        scores.set(
          rule.category,
          (scores.get(rule.category) ?? 0) + rule.weight,
        );
      }
    }

    // Elegir la categoria de mayor puntaje; default OTHER.
    let category: Category = 'OTHER';
    let best = 0;
    for (const [cat, score] of scores) {
      if (score > best) {
        best = score;
        category = cat;
      }
    }

    const sentiment = analyzeSentiment(normalizedText);
    const isSensitive = category === 'POLITICS';

    return { category, sentiment, isSensitive };
  }
}
