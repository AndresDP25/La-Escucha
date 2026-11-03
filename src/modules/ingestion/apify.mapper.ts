/**
 * Traduce el dataset crudo de `apify/instagram-scraper` a nuestro payload canonico.
 *
 * El actor de Posts no envia `comments`: envia `latestComments` (una muestra).
 * El dataset es un array de posts, no `{ externalId, posts }`.
 *
 * Tambien extrae usernames candidatos para la watchlist (cuentas que comentaron,
 * mencionaron o fueron tagueadas), sin scrapear followers.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  IngestionPayloadSchema,
  type IngestionPayload,
  type RawComment,
  type RawPost,
} from './ingestion.schema';

const MENTION_IN_TEXT = /@([a-zA-Z0-9._]+)/g;

const ApifyCommentSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform((v) => String(v)),
    text: z.string().optional().default(''),
    ownerUsername: z.string().optional(),
    likesCount: z.number().nullish(),
    timestamp: z.string().optional(),
  })
  .passthrough();

const ApifyPostSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform((v) => String(v)),
    url: z.string().optional(),
    ownerUsername: z.string().optional(),
    caption: z.string().optional(),
    timestamp: z.string().optional(),
    commentsCount: z.number().optional(),
    likesCount: z.number().optional(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    latestComments: z.array(ApifyCommentSchema).optional(),
    comments: z.array(ApifyCommentSchema).optional(),
    taggedUsers: z
      .array(z.object({ username: z.string().optional() }).passthrough())
      .optional(),
  })
  .passthrough();

export const ApifyDatasetSchema = z.array(ApifyPostSchema).min(1);

export interface DiscoveredAccount {
  username: string;
  /** De donde salio: comento, mencion en caption, tag, mencion en comentario. */
  reason: 'comment_author' | 'caption_mention' | 'tagged_user' | 'comment_mention';
  postId: string;
}

export interface ApifyMapResult {
  payload: IngestionPayload;
  discoveredAccounts: DiscoveredAccount[];
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function urlFromMedia(value: unknown): string | undefined {
  const direct = httpUrl(value);
  if (direct) return direct;
  if (!value || typeof value !== 'object') return undefined;
  const media = value as Record<string, unknown>;
  return httpUrl(media.media_url_https) ?? httpUrl(media.url) ?? httpUrl(media.displayUrl);
}

/** Primera imagen que mande el scraper: Instagram usa displayUrl, Twitter usa media. */
export function pickImageUrl(source: unknown): string | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const post = source as Record<string, unknown>;
  const direct =
    httpUrl(post.displayUrl) ?? httpUrl(post.imageUrl) ?? httpUrl(post.thumbnailUrl);
  if (direct) return direct;

  for (const list of [post.images, post.media, post.photos]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const url = urlFromMedia(item);
      if (url) return url;
    }
  }

  const extended = post.extendedEntities;
  if (extended && typeof extended === 'object') {
    const media = (extended as Record<string, unknown>).media;
    if (Array.isArray(media)) {
      for (const item of media) {
        const url = urlFromMedia(item);
        if (url) return url;
      }
    }
  }
  return undefined;
}

function toComment(raw: z.infer<typeof ApifyCommentSchema>): RawComment {
  return {
    id: raw.id,
    text: raw.text,
    ownerUsername: raw.ownerUsername,
    likesCount: raw.likesCount ?? undefined,
    timestamp: raw.timestamp,
  };
}

/** Huella estable del dataset: mismo posts => mismo id de lote (idempotencia). */
export function fingerprintDataset(posts: { id: string }[]): string {
  const key = posts
    .map((p) => p.id)
    .sort()
    .join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

function mentionsInText(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(MENTION_IN_TEXT)) {
    const username = match[1]?.toLowerCase();
    if (username) found.push(username);
  }
  return found;
}

function collectDiscovered(post: z.infer<typeof ApifyPostSchema>): DiscoveredAccount[] {
  const postId = post.id;
  const owner = post.ownerUsername?.toLowerCase();
  const seen = new Set<string>();
  const out: DiscoveredAccount[] = [];

  const add = (username: string | undefined, reason: DiscoveredAccount['reason']) => {
    const key = username?.trim().replace(/^@/, '').toLowerCase();
    if (!key || key === owner || seen.has(key)) return;
    seen.add(key);
    out.push({ username: key, reason, postId });
  };

  for (const comment of post.latestComments ?? post.comments ?? []) {
    add(comment.ownerUsername, 'comment_author');
    for (const mention of mentionsInText(comment.text)) {
      add(mention, 'comment_mention');
    }
  }

  for (const mention of post.mentions ?? []) {
    add(mention, 'caption_mention');
  }

  for (const tagged of post.taggedUsers ?? []) {
    add(tagged.username, 'tagged_user');
  }

  if (post.caption) {
    for (const mention of mentionsInText(post.caption)) {
      add(mention, 'caption_mention');
    }
  }

  return out;
}

function toCanonicalPost(post: z.infer<typeof ApifyPostSchema>): RawPost {
  const sample = post.latestComments ?? post.comments ?? [];
  return {
    id: post.id,
    url: post.url,
    ownerUsername: post.ownerUsername,
    caption: post.caption,
    imageUrl: pickImageUrl(post),
    timestamp: post.timestamp,
    comments: sample.map(toComment),
  };
}

/**
 * Convierte un dataset de Apify (array de posts) al payload que entiende la ingesta.
 *
 * @param dataset Array crudo del export JSON.
 * @param externalId Id de lote (usar el runId de Apify cuando exista).
 */
export function mapApifyDataset(
  dataset: unknown,
  externalId?: string,
): ApifyMapResult {
  const posts = ApifyDatasetSchema.parse(dataset);

  const payload = IngestionPayloadSchema.parse({
    externalId: externalId ?? `apify-${fingerprintDataset(posts)}`,
    source: 'apify',
    posts: posts.map(toCanonicalPost),
  });

  const discoveredAccounts = posts.flatMap(collectDiscovered);

  return { payload, discoveredAccounts };
}

/** Detecta si el body parece un dataset de Apify (array de posts). */
export function isApifyDataset(body: unknown): boolean {
  return Array.isArray(body) && body.length > 0 && typeof body[0] === 'object';
}
