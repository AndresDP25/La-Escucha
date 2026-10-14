/**
 * Mapea un export JSON de Apify (array de posts) a nuestro payload canonico.
 *
 * No llama a Apify ni gasta credito. Uso:
 *
 *   npm run map:apify -- "../info - social - listening/dataset_instagram-scraper_2026-10-12_22-17-24-247.json"
 *
 * Escribe un archivo *-mapped.json al lado del original y lista cuentas descubiertas.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapApifyDataset } from '../src/modules/ingestion/apify.mapper';

const inputPath = process.argv[2];
if (!inputPath) {
  // eslint-disable-next-line no-console
  console.error(
    'Uso: npm run map:apify -- <ruta-al-dataset.json> [externalId-opcional]',
  );
  process.exit(1);
}

const externalId = process.argv[3];
const abs = resolve(inputPath);
const raw = JSON.parse(readFileSync(abs, 'utf8')) as unknown;
const { payload, discoveredAccounts } = mapApifyDataset(raw, externalId);

const outPath = abs.replace(/\.json$/i, '-mapped.json');
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

const commentCount = payload.posts.reduce((n, p) => n + p.comments.length, 0);

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      input: abs,
      output: outPath,
      externalId: payload.externalId,
      posts: payload.posts.length,
      comments: commentCount,
      discoveredAccounts: discoveredAccounts.length,
      accounts: discoveredAccounts,
    },
    null,
    2,
  ),
);
