import { describe, expect, it } from 'vitest';
import type { KeywordConfig } from '@prisma/client';
import { KeywordClassifier } from '../src/core/classifier/keyword-classifier';
import { PARTY_KEYWORDS } from '../src/core/classifier/party-keywords';
import { normalizeText } from '../src/core/text/text-processor';

function partyClassifier(): KeywordClassifier {
  const keywords = PARTY_KEYWORDS.flatMap((group) =>
    group.patterns.map(
      (pattern) =>
        ({
          id: pattern,
          tenantId: 'party',
          category: group.category,
          pattern,
          matchType: 'LITERAL',
          weight: group.weight ?? 1,
          isActive: true,
          createdAt: new Date(),
        }) satisfies KeywordConfig,
    ),
  );
  return new KeywordClassifier(keywords);
}

describe('diccionario del partido', () => {
  const classifier = partyClassifier();

  it('lee una crítica como crítica, aunque nombre al partido', async () => {
    const result = await classifier.classify({
      normalizedText: normalizeText(
        'Los del Pro saludando a un ganador por Fraude. Qué decepción.',
      ),
      cleanText: '',
    });
    expect(result.category).toBe('ATTACK');
    expect(result.sentiment).toBe('NEGATIVE');
  });

  it('deja en político un comentario que solo nombra candidatos', async () => {
    const result = await classifier.classify({
      normalizedText: normalizeText('Jorge Macri futuro presidente'),
      cleanText: '',
    });
    expect(result.category).toBe('POLITICS');
  });

  it('prioriza salud cuando el comentario habla de suicidio', async () => {
    const result = await classifier.classify({
      normalizedText: normalizeText('Nunca se suicidó ni un político'),
      cleanText: '',
    });
    expect(result.category).toBe('HEALTH');
  });
});