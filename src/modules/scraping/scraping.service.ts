/**
 * Búsqueda manual: el perfil de Instagram de la cuenta activa -> Apify -> ingesta.
 * No mira la watchlist ni otros objetivos. San Fernando busca @sanfermunicipio;
 * otra cuenta busca el suyo.
 */
import { prisma } from '../../db/prisma';
import { analyzeSentiment } from '../../core/classifier/sentiment';
import { normalizeText } from '../../core/text/text-processor';
import { ValidationError } from '../../shared/errors';
import { mapApifyDataset } from '../ingestion/apify.mapper';
import type { RawPost } from '../ingestion/ingestion.schema';
import { ingestPayload } from '../ingestion/ingestion.service';
import { upsertDiscoveredAccounts } from '../watchlist/watchlist.service';
import { processIngestionEvent } from '../processing/processing.service';
import { mapTwitterDataset } from '../ingestion/twitter.mapper';
import { apifyConfigured, scrapeInstagramPosts, scrapeTweets } from './apify.client';

type Report = (text: string) => void;

const STEP_GAP_MS = 350;

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, STEP_GAP_MS));
}

async function say(report: Report, text: string): Promise<void> {
  report(text);
  await pause();
}

function postLabel(post: RawPost): string {
  const caption = post.caption?.trim().replace(/\s+/g, ' ');
  if (caption) return caption.length > 48 ? `${caption.slice(0, 48)}…` : caption;
  return post.id.slice(-6);
}

function tally(post: RawPost): { positive: number; negative: number; neutral: number } {
  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const comment of post.comments) {
    const sentiment = analyzeSentiment(normalizeText(comment.text));
    if (sentiment === 'POSITIVE') counts.positive += 1;
    else if (sentiment === 'NEGATIVE') counts.negative += 1;
    else counts.neutral += 1;
  }
  return counts;
}

function commentLine(total: number, counts: { positive: number; negative: number; neutral: number }): string {
  if (total === 0) return 'Esta publicación no tiene comentarios.';
  const extracted = total === 1 ? 'Extraído 1 comentario' : `Extraídos ${total} comentarios`;
  return `${extracted}: ${counts.positive} positivos, ${counts.negative} negativos y ${counts.neutral} neutros.`;
}

function profileNames(post: RawPost): string[] {
  const names = new Set<string>();
  for (const comment of post.comments) {
    const name = comment.ownerUsername?.trim().replace(/^@/, '');
    if (name) names.add(name);
  }
  return [...names].slice(0, 3);
}

async function narratePosts(posts: RawPost[], report: Report): Promise<void> {
  for (const post of posts) {
    await say(report, `Revisando publicación: ${postLabel(post)}`);
    await say(report, commentLine(post.comments.length, tally(post)));
    for (const name of profileNames(post)) {
      await say(report, `Revisando perfil @${name}`);
    }
  }
}

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
  report: Report = () => undefined,
) {
  const handles = await listSearchAccounts(tenantId);
  if (network === 'twitter') {
    return runTwitterSearch(tenantId, handles.twitter, resultsPerAccount, report);
  }
  const accounts = handles.instagram ? [handles.instagram] : [];
  const urls = accounts
    .map(toInstagramUrl)
    .filter((url): url is string => Boolean(url));

  if (urls.length === 0) {
    throw new ValidationError('Esta cuenta no tiene un perfil de Instagram.');
  }

  report(`Bajando publicaciones de ${accounts[0]}.`);
  const { runId, items } = await scrapeInstagramPosts(urls, resultsPerAccount);
  if (items.length === 0) {
    report('No llegaron publicaciones.');
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
  await narratePosts(mapped.payload.posts, report);
  await say(report, 'Guardando lo leído.');
  await upsertDiscoveredAccounts(tenantId, mapped.discoveredAccounts);
  const ingested = await ingestPayload(tenantId, mapped.payload);
  if (!ingested.duplicated) {
    await processIngestionEvent(ingested.ingestionEventId);
  }

  const comments = mapped.payload.posts.reduce(
    (sum, post) => sum + post.comments.length,
    0,
  );

  const posts = mapped.payload.posts.length;
  if (ingested.duplicated) {
    await say(report, 'Esas publicaciones ya estaban cargadas.');
  } else {
    await say(report, `Listo. Entraron ${posts} publicaciones y ${comments} comentarios.`);
  }
  return {
    network: 'instagram' as const,
    accounts,
    resultsPerAccount,
    posts,
    comments,
    duplicated: ingested.duplicated,
  };
}

async function runTwitterSearch(
  tenantId: string,
  account: string | null,
  resultsPerAccount: number,
  report: Report,
) {
  const handle = account ? normalizeTwitterHandle(account) : null;
  if (!handle) {
    throw new ValidationError('Esta cuenta no tiene un usuario de Twitter.');
  }

  const accounts = [`@${handle}`];
  report(`Bajando publicaciones de @${handle}.`);
  const { runId, items } = await scrapeTweets(handle, resultsPerAccount);
  if (items.length === 0) {
    report('No llegaron publicaciones.');
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
  await narratePosts(mapped.payload.posts, report);
  await say(report, 'Guardando lo leído.');
  await upsertDiscoveredAccounts(tenantId, mapped.discoveredAccounts, 'twitter');
  const ingested = await ingestPayload(tenantId, mapped.payload);
  if (!ingested.duplicated) {
    await processIngestionEvent(ingested.ingestionEventId);
  }
  const comments = mapped.payload.posts.reduce(
    (sum, post) => sum + post.comments.length,
    0,
  );
  const posts = mapped.payload.posts.length;
  if (ingested.duplicated) {
    await say(report, 'Esas publicaciones ya estaban cargadas.');
  } else {
    await say(report, `Listo. Entraron ${posts} publicaciones y ${comments} comentarios.`);
  }
  return {
    network: 'twitter' as const,
    accounts,
    resultsPerAccount,
    posts,
    comments,
    duplicated: ingested.duplicated,
  };
}

export { apifyConfigured };
