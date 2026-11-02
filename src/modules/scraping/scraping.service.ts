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
import { mapTwitterDataset } from '../ingestion/twitter.mapper';
import { apifyConfigured, scrapeInstagramPosts, scrapeTweets } from './apify.client';

export type SearchNetwork = 'instagram' | 'twitter';

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

/** Usuario de Twitter/X, sin @ ni URL. */
export function normalizeTwitterHandle(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const fromUrl = raw.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
  const username = (fromUrl?.[1] ?? raw.replace(/^@/, '')).replace(/\/+$/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(username)) return null;
  return username;
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

export async function listSearchAccounts(tenantId: string): Promise<{
  instagram: string | null;
  twitter: string | null;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { instagramHandle: true, twitterHandle: true },
  });
  const instagram = tenant?.instagramHandle ? normalizeHandle(tenant.instagramHandle) : null;
  const twitter = tenant?.twitterHandle ? normalizeTwitterHandle(tenant.twitterHandle) : null;
  return {
    instagram: instagram ? `@${instagram}` : null,
    twitter: twitter ? `@${twitter}` : null,
  };
}

export async function runTenantSearch(
  tenantId: string,
  resultsPerAccount: number,
  network: SearchNetwork = 'instagram',
) {
  const handles = await listSearchAccounts(tenantId);
  if (network === 'twitter') {
    return runTwitterSearch(tenantId, handles.twitter, resultsPerAccount);
  }
  const accounts = handles.instagram ? [handles.instagram] : [];
  const urls = accounts
    .map(toInstagramUrl)
    .filter((url): url is string => Boolean(url));

  if (urls.length === 0) {
    throw new ValidationError('Esta cuenta no tiene un perfil de Instagram.');
  }

  const { runId, items } = await scrapeInstagramPosts(urls, resultsPerAccount);
  if (items.length === 0) {
    return {
      network: 'instagram' as const,
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
    network: 'instagram' as const,
    accounts,
    resultsPerAccount,
    posts: mapped.payload.posts.length,
    comments,
    duplicated: ingested.duplicated,
  };
}

async function runTwitterSearch(
  tenantId: string,
  account: string | null,
  resultsPerAccount: number,
) {
  const handle = account ? normalizeTwitterHandle(account) : null;
  if (!handle) {
    throw new ValidationError('Esta cuenta no tiene un usuario de Twitter.');
  }

  const { runId, items } = await scrapeTweets(handle, resultsPerAccount);
  const accounts = [`@${handle}`];
  if (items.length === 0) {
    return {
      network: 'twitter' as const,
      accounts,
      resultsPerAccount,
      posts: 0,
      comments: 0,
      duplicated: false,
    };
  }

  const mapped = mapTwitterDataset(items, handle, runId);
  await upsertDiscoveredAccounts(tenantId, mapped.discoveredAccounts, 'twitter');
  const ingested = await ingestPayload(tenantId, mapped.payload);
  if (!ingested.duplicated) {
    await processIngestionEvent(ingested.ingestionEventId);
  }
  const comments = mapped.payload.posts.reduce(
    (sum, post) => sum + post.comments.length,
    0,
  );
  return {
    network: 'twitter' as const,
    accounts,
    resultsPerAccount,
    posts: mapped.payload.posts.length,
    comments,
    duplicated: ingested.duplicated,
  };
}

export { apifyConfigured };
