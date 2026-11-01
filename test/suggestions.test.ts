import { describe, expect, it } from 'vitest';
import type { PostRow } from '../web/src/api';
import { buildThemeSuggestions } from '../web/src/suggestions';

function post(partial: Partial<PostRow> & Pick<PostRow, 'id'>): PostRow {
  return {
    caption: null,
    url: null,
    ownerUsername: null,
    publishedAt: null,
    comments: [],
    ...partial,
  };
}

describe('buildThemeSuggestions', () => {
  it('sugiere el pedido concreto de cada tema', () => {
    const themes = buildThemeSuggestions([
      post({
        id: 'a',
        caption: 'Limpieza de carteles',
        comments: [
          {
            id: '1',
            cleanText: 'y las veredas para cuando?',
            category: 'PUBLIC_WORKS',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: '2026-10-20T12:00:00.000Z',
          },
          {
            id: '2',
            cleanText: 'las veredas de sargento cabral están rotas',
            category: 'PUBLIC_WORKS',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: '2026-10-21T12:00:00.000Z',
          },
          {
            id: '3',
            rawText: 'Pongan más plata en el hospital cordero ahí es',
            cleanText: 'pongan mas plata en el hospital cordero',
            category: 'HEALTH',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: '2026-10-19T12:00:00.000Z',
          },
        ],
      }),
    ]);

    const works = themes.find((theme) => theme.category === 'PUBLIC_WORKS');
    const health = themes.find((theme) => theme.category === 'HEALTH');
    expect(works?.asks.some((ask) => ask.text.includes('Arreglar las veredas'))).toBe(true);
    expect(health?.asks[0].text).toContain('hospital cordero');
  });

  it('en política dice a quién rechazan y a quién acompañan', () => {
    const themes = buildThemeSuggestions([
      post({
        id: 'p',
        caption: 'Elecciones',
        comments: [
          {
            id: '1',
            cleanText: 'no a jorge',
            category: 'POLITICS',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: null,
          },
          {
            id: '2',
            cleanText: 'voto a maria',
            category: 'POLITICS',
            sentiment: 'POSITIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: null,
          },
        ],
      }),
    ]);
    const politics = themes.find((theme) => theme.category === 'POLITICS');
    expect(politics?.asks[0].text).toContain('rechazan a Jorge');
    expect(politics?.asks[0].text).toContain('acompañan a Maria');
  });

  it('no inventa un tema cuando todo queda en Otros', () => {
    const themes = buildThemeSuggestions([
      post({
        id: 'a',
        caption: 'Hola',
        comments: [
          {
            id: '1',
            cleanText: 'hola qué tal',
            category: 'OTHER',
            sentiment: 'NEUTRAL',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: null,
          },
        ],
      }),
    ]);
    expect(themes).toEqual([]);
  });
});
