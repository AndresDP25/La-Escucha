import { describe, it, expect } from 'vitest';
import { mapApifyDataset } from '../src/modules/ingestion/apify.mapper';

const sampleDataset = [
  {
    id: '4002850218218579385',
    caption: 'real-time AR\n#InTheMoment\nVideo by @alwayscodingsomething',
    hashtags: ['InTheMoment'],
    mentions: ['alwayscodingsomething'],
    url: 'https://www.instagram.com/p/DeM-xDCA2W5/',
    commentsCount: 11760,
    latestComments: [
      {
        id: '18105566981271754',
        text: 'magic',
        ownerUsername: 'sunn_ychukwudi',
        timestamp: '2026-10-12T22:04:42.000Z',
        likesCount: 0,
      },
      {
        id: '17910962649516741',
        text: '@gol.online33',
        ownerUsername: 'fun_o_fon',
        timestamp: '2026-10-12T21:28:57.000Z',
        likesCount: 1,
      },
    ],
    timestamp: '2026-10-07T18:17:32.000Z',
    ownerUsername: 'instagram',
    taggedUsers: [{ username: 'alwayscodingsomething' }],
  },
];

describe('mapApifyDataset', () => {
  it('traduce latestComments a comments y arma el payload canonico', () => {
    const { payload } = mapApifyDataset(sampleDataset, 'run-test');

    expect(payload.source).toBe('apify');
    expect(payload.externalId).toBe('run-test');
    expect(payload.posts).toHaveLength(1);
    expect(payload.posts[0].id).toBe('4002850218218579385');
    expect(payload.posts[0].ownerUsername).toBe('instagram');
    expect(payload.posts[0].comments).toHaveLength(2);
    expect(payload.posts[0].comments[0].ownerUsername).toBe('sunn_ychukwudi');
    expect(payload.posts[0].comments[1].text).toBe('@gol.online33');
  });

  it('descubre cuentas de comentarios, menciones y tags (sin el owner del post)', () => {
    const { discoveredAccounts } = mapApifyDataset(sampleDataset);

    const usernames = discoveredAccounts.map((a) => a.username);
    expect(usernames).not.toContain('instagram');
    expect(usernames).toContain('sunn_ychukwudi');
    expect(usernames).toContain('fun_o_fon');
    expect(usernames).toContain('gol.online33');
    expect(usernames).toContain('alwayscodingsomething');
  });

  it('usa la misma huella si no hay externalId', () => {
    const a = mapApifyDataset(sampleDataset);
    const b = mapApifyDataset(sampleDataset);
    expect(a.payload.externalId).toBe(b.payload.externalId);
    expect(a.payload.externalId).toMatch(/^apify-/);
  });
});
