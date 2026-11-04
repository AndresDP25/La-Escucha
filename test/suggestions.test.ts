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
            cleanText: 'arreglen las veredas',
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
          {
            id: '4',
            cleanText: 'hay que poner más presupuesto en el hospital cordero',
            category: 'HEALTH',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: '2026-10-19T13:00:00.000Z',
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

  it('no arma un arreglo con una mención suelta ni con un solo comentario', () => {
    const themes = buildThemeSuggestions([
      post({
        id: 'obras',
        caption: 'Reclamos',
        comments: [
          {
            id: '1',
            rawText:
              'Empezá a tapar los baches de CABA!!!, cansado de mandarle fotos de crateres a Ignacio',
            cleanText: 'empezá a tapar los baches de caba',
            category: 'PUBLIC_WORKS',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: null,
          },
          {
            id: '2',
            rawText: 'La ILEGALIDAD sigue en la calle del polo textil de Flores',
            cleanText: 'la ilegalidad sigue en la calle del polo textil',
            category: 'PUBLIC_WORKS',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: null,
          },
          {
            id: '3',
            cleanText: 'dedicaron seguridad a las calles de la ciudad y menos a las elecciones',
            category: 'POLITICS',
            sentiment: 'NEGATIVE',
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

  it('junta dos pedidos iguales de baches y corta el lugar en el nombre', () => {
    const themes = buildThemeSuggestions([
      post({
        id: 'baches',
        caption: 'Calles',
        comments: [
          {
            id: '1',
            rawText: 'Empezá a tapar los baches de CABA, cansado de mandarle fotos',
            cleanText: 'tapar los baches de caba',
            category: 'PUBLIC_WORKS',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: null,
          },
          {
            id: '2',
            cleanText: 'arreglen los baches de CABA por favor',
            category: 'PUBLIC_WORKS',
            sentiment: 'NEGATIVE',
            isAnonymized: false,
            emojis: [],
            likeCount: 0,
            publishedAt: null,
          },
        ],
      }),
    ]);
    const works = themes.find((theme) => theme.category === 'PUBLIC_WORKS');
    expect(works?.asks).toHaveLength(1);
    expect(works?.asks[0].text).toBe('Arreglar los baches de CABA.');
    expect(works?.asks[0].count).toBe(2);
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
