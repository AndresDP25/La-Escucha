/**
 * Carga la watchlist desde un export de Apify, sin volver a scrapear.
 *
 *   npm run watchlist:backfill -- "../info - social - listening/dataset_instagram-scraper_2026-10-12_22-17-24-247.json"
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/db/prisma';
import { mapApifyDataset } from '../src/modules/ingestion/apify.mapper';
import { upsertDiscoveredAccounts } from '../src/modules/watchlist/watchlist.service';

const file = process.argv[2];
const slug = process.argv[3] ?? 'agusciarletta';

async function main(): Promise<void> {
  if (!file) {
    throw new Error('Uso: npm run watchlist:backfill -- <dataset.json> [slug]');
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant '${slug}' no existe. Correr npm run db:seed`);

  const raw = JSON.parse(readFileSync(resolve(file), 'utf8')) as unknown;
  const { discoveredAccounts } = mapApifyDataset(raw);
  const count = await upsertDiscoveredAccounts(tenant.id, discoveredAccounts);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { tenant: slug, upserted: count, unique: discoveredAccounts.length },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
