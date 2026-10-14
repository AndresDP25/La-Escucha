/**
 * POST a un dataset Apify (o payload canonico) al webhook local, firmado HMAC.
 *
 *   npm run ingest:local -- "../info - social - listening/dataset_instagram-scraper_2026-10-12_22-17-24-247.json"
 *
 * Requiere API levantada (`npm run dev`) y tenant seed (slug san-fernando).
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/db/prisma';

const file = process.argv[2];
const slug = process.argv[3] ?? 'agusciarletta';
const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';

async function main(): Promise<void> {
  if (!file) {
    throw new Error('Uso: npm run ingest:local -- <dataset.json> [slug]');
  }

  const body = readFileSync(resolve(file));
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { webhookSecret: true, isActive: true },
  });
  if (!tenant?.isActive) {
    throw new Error(`Tenant '${slug}' no encontrado. Correr npm run db:seed`);
  }

  const signature = createHmac('sha256', tenant.webhookSecret)
    .update(body)
    .digest('hex');

  const res = await fetch(`${baseUrl}/webhooks/ingest/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': `sha256=${signature}`,
    },
    body,
  });

  const json = await res.json();
  // eslint-disable-next-line no-console
  console.log(res.status, JSON.stringify(json, null, 2));
  if (!res.ok) process.exit(1);
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
