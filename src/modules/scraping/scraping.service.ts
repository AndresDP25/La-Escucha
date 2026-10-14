/**
 * Búsqueda manual: el perfil de Instagram de la cuenta activa -> Apify -> ingesta.
 * No mira la watchlist ni otros objetivos. San Fernando busca @sanfermunicipio;
 * otra cuenta busca el suyo.
 */
import { prisma } from '../../db/prisma';
import { ValidationError } from '../../shared/errors';
import { mapApifyDataset } from '../ingestion/apify.mapper';
import { ingestPayload } from '../ingestion/ingestion.service';
import { upsertDiscoveredAccounts } from '../watchlist/watchlist.service';
import { processIngestionEvent } from '../processing/processing.service';
import { apifyConfigured, scrapeInstagramPosts } from './apify.client';

export const RESULTS_MIN = 1;
export const RESULTS_MAX = 20;
export const RESULTS_DEFAULT = 5;

export function toInstagramUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const username = raw.replace(/^@/, '');
  if (!/^[a-zA-Z0-9._]+$/.test(username)) return null;
  return `https://www.instagram.com/${username}/`;
}

/** Deja el usuario sin @ ni URL. */
export function normalizeHandle(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const fromUrl = raw.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  const username = (fromUrl?.[1] ?? raw.replace(/^@/, '')).replace(/\/+$/, '').toLowerCase();
  if (!/^[a-z0-9._]+$/.test(username)) return null;
  return username;
}

export async function listSearchAccounts(tenantId: string): Promise<string[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { instagramHandle: true },
  });
  const handle = tenant?.instagramHandle ? normalizeHandle(tenant.instagramHandle) : null;
  return handle ? [`@${handle}`] : [];
}

export async function runTenantSearch(tenantId: string, resultsPerAccount: number) {
  const accounts = await listSearchAccounts(tenantId);
  const urls = accounts
    .map(toInstagramUrl)
    .filter((url): url is string => Boolean(url));

  if (urls.length === 0) {
    throw new ValidationError('Esta cuenta no tiene un perfil de Instagram.');
  }

  const { runId, items } = await scrapeInstagramPosts(urls, resultsPerAccount);
  if (items.length === 0) {
    return {
      accounts,
      resultsPerAccount,
      posts: 0,
      comments: 0,
      duplicated: false,
    };
  }

  const mapped = mapApifyDataset(items, runId);
  await upsertDiscoveredAccounts(tenantId, mapped.discoveredAccounts);
  const ingested = await ingestPayload(tenantId, mapped.payload);
  if (!ingested.duplicated) {
    await processIngestionEvent(ingested.ingestionEventId);
  }

  const comments = mapped.payload.posts.reduce(
    (sum, post) => sum + post.comments.length,
    0,
  );

  return {
    accounts,
    resultsPerAccount,
    posts: mapped.payload.posts.length,
    comments,
    duplicated: ingested.duplicated,
  };
}

export { apifyConfigured };
