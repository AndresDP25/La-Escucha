import { describe, expect, it } from 'vitest';
import { mapTwitterDataset } from '../src/modules/ingestion/twitter.mapper';
import { normalizeTwitterHandle } from '../src/modules/scraping/scraping.service';

describe('twitter', () => {
  it('separa tuits y respuestas', () => {
    const mapped = mapTwitterDataset(
      [
        {
          id: '10',
          fullText: 'La ley y el orden.',
          twitterUrl: 'https://x.com/prociudadbsas/status/10',
          createdAt: 'Thu Oct 24 13:00:00 +0000 2026',
          author: { userName: 'prociudadbsas' },
        },
        {
          id: '11',
          text: 'Qué decepción.',
          isReply: true,
          inReplyToId: '10',
          createdAt: '2026-10-24T15:00:00.000Z',
          author: { userName: 'alguien' },
        },
        {
          id: '12',
          text: 'Respuesta suelta',
          isReply: true,
          createdAt: '2026-10-24T16:00:00.000Z',
          author: { userName: 'otro' },
        },
      ],
      'prociudadbsas',
      'run-1',
    );

    expect(mapped.payload.network).toBe('twitter');
    const post = mapped.payload.posts.find((item) => item.id === '10');
    expect(post?.comments.map((comment) => comment.text)).toEqual(['Qué decepción.']);
    const inbox = mapped.payload.posts.find((item) => item.id === 'replies-prociudadbsas');
    expect(inbox?.comments).toHaveLength(1);
    expect(mapped.discoveredAccounts.map((account) => account.username)).toEqual([
      'alguien',
      'otro',
    ]);
  });

  it('guarda el tuit completo cuando el texto visible viene cortado', () => {
    const mapped = mapTwitterDataset(
      [
        {
          id: '20',
          text: 'RT @alguien: texto cortado…',
          fullText: 'RT @alguien: texto cortado…',
          isRetweet: true,
          retweet: {
            fullText: 'Texto completo del tuit original, que no entra en el recorte.',
            author: { userName: 'alguien' },
          },
          author: { userName: 'proargentina' },
        },
      ],
      'proargentina',
      'run-2',
    );
    expect(mapped.payload.posts[0]?.caption).toBe(
      'RT @alguien: Texto completo del tuit original, que no entra en el recorte.',
    );
  });

  it('acepta un usuario o una url de X', () => {
    expect(normalizeTwitterHandle('@ProArgentina')).toBe('proargentina');
    expect(normalizeTwitterHandle('https://x.com/prociudadbsas')).toBe('prociudadbsas');
    expect(normalizeTwitterHandle('esto no es un usuario largo')).toBeNull();
  });
});