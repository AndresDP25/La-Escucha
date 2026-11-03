/**
 * Traduce tuits de apidojo/tweet-scraper al payload de ingesta.
 * El tuit original es un post. La respuesta es un comentario de ese post,
 * o de un post sintético si el original no vino en la misma corrida.
 */
import { z } from 'zod';
import {
  IngestionPayloadSchema,
  type IngestionPayload,
  type RawComment,
  type RawPost,
} from './ingestion.schema';
import { fingerprintDataset, pickImageUrl, type ApifyMapResult, type DiscoveredAccount } from './apify.mapper';

const TweetSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform((value) => String(value)),
    text: z.string().optional(),
    fullText: z.string().optional(),
    isRetweet: z.boolean().optional(),
    retweet: z
      .object({
        text: z.string().optional(),
        fullText: z.string().optional(),
        author: z
          .object({
            userName: z.string().optional(),
            username: z.string().optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
    quote: z
      .object({
        text: z.string().optional(),
        fullText: z.string().optional(),
      })
      .partial()
      .optional(),
    url: z.string().optional(),
    twitterUrl: z.string().optional(),
    createdAt: z.string().optional(),
    isReply: z.boolean().optional(),
    inReplyToId: z.union([z.string(), z.number()]).optional(),
    inReplyToStatusId: z.union([z.string(), z.number()]).optional(),
    author: z
      .object({
        userName: z.string().optional(),
        username: z.string().optional(),
      })
      .partial()
      .optional(),
    user: z
      .object({
        screen_name: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

function authorOf(tweet: z.infer<typeof TweetSchema>): string | undefined {
  return tweet.author?.userName ?? tweet.author?.username ?? tweet.user?.screen_name;
}

function bodyOf(value: { fullText?: string; text?: string } | undefined): string {
  return (value?.fullText ?? value?.text ?? '').trim();
}

function textOf(tweet: z.infer<typeof TweetSchema>): string {
  const own = bodyOf(tweet);
  const retweet = bodyOf(tweet.retweet);
  const quote = bodyOf(tweet.quote);
  const nested = retweet.length >= quote.length ? retweet : quote;
  if (nested.length > own.length) {
    const author = tweet.retweet?.author?.userName ?? tweet.retweet?.author?.username;
    if (tweet.isRetweet && author && nested === retweet) return `RT @${author}: ${nested}`;
    return nested;
  }
  return own;
}

function parentId(tweet: z.infer<typeof TweetSchema>): string | null {
  const parent = tweet.inReplyToId ?? tweet.inReplyToStatusId;
  if (parent != null && String(parent)) return String(parent);
  if (tweet.isReply) return null;
  return null;
}

function iso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function mapTwitterDataset(
  dataset: unknown,
  handle: string,
  externalId?: string,
): ApifyMapResult {
  const tweets = z.array(TweetSchema).min(1).parse(dataset);
  const originals = new Map<string, RawPost>();
  const replies: { parent: string | null; comment: RawComment }[] = [];
  const discovered: DiscoveredAccount[] = [];
  const seen = new Set<string>();

  for (const tweet of tweets) {
    const author = authorOf(tweet)?.replace(/^@/, '').toLowerCase();
    const replyTo = parentId(tweet);
    const isReply = tweet.isReply === true || replyTo != null;
    if (isReply) {
      replies.push({
        parent: replyTo,
        comment: {
          id: tweet.id,
          text: textOf(tweet),
          ownerUsername: author,
          timestamp: iso(tweet.createdAt),
        },
      });
      if (author && author !== handle && !seen.has(author)) {
        seen.add(author);
        discovered.push({
          username: author,
          reason: 'comment_author',
          postId: replyTo ?? `replies-${handle}`,
        });
      }
      continue;
    }

    originals.set(tweet.id, {
      id: tweet.id,
      url: tweet.twitterUrl ?? tweet.url ?? `https://x.com/${author ?? handle}/status/${tweet.id}`,
      ownerUsername: author ?? handle,
      caption: textOf(tweet),
      imageUrl: pickImageUrl(tweet),
      timestamp: iso(tweet.createdAt),
      comments: [],
    });
  }

  const inboxId = `replies-${handle}`;
  for (const reply of replies) {
    const parent = reply.parent && originals.get(reply.parent);
    if (parent) {
      parent.comments.push(reply.comment);
      continue;
    }
    let inbox = originals.get(inboxId);
    if (!inbox) {
      inbox = {
        id: inboxId,
        url: `https://x.com/search?q=to%3A${handle}&f=live`,
        ownerUsername: handle,
        caption: `Respuestas a @${handle}`,
        comments: [],
      };
      originals.set(inboxId, inbox);
    }
    inbox.comments.push(reply.comment);
  }

  const posts = [...originals.values()];
  const payload: IngestionPayload = IngestionPayloadSchema.parse({
    externalId: externalId ?? `twitter-${fingerprintDataset(posts)}`,
    source: 'apify',
    network: 'twitter',
    posts,
  });

  return { payload, discoveredAccounts: discovered };
}
