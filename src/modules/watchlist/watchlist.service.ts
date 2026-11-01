/**
 * Lista paralela de cuentas descubiertas (watchlist).
 *
 * Un scrape NO las monitorea solas: quedan PENDING hasta que un ADMIN las
 * pase a WATCHING (ahi se crea un ScrapeTarget). Asi la lista no explota.
 */
import type { DiscoveryReason, WatchlistStatus } from '@prisma/client';
import { pseudonymizeAuthor } from '../../core/privacy/anonymizer';
import { prisma } from '../../db/prisma';
import type { DiscoveredAccount } from '../ingestion/apify.mapper';

const REASON_MAP: Record<DiscoveredAccount['reason'], DiscoveryReason> = {
  comment_author: 'COMMENT_AUTHOR',
  caption_mention: 'CAPTION_MENTION',
  tagged_user: 'TAGGED_USER',
  comment_mention: 'COMMENT_MENTION',
};

export async function upsertDiscoveredAccounts(
  tenantId: string,
  accounts: DiscoveredAccount[],
  network: 'instagram' | 'twitter' = 'instagram',
): Promise<number> {
  let count = 0;
  for (const account of accounts) {
    const username = account.username.trim().toLowerCase();
    if (!username) continue;

    await prisma.watchlistAccount.upsert({
      where: { tenantId_network_username: { tenantId, network, username } },
      create: {
        tenantId,
        network,
        username,
        reason: REASON_MAP[account.reason],
        status: 'PENDING',
        lastPostExternalId: account.postId,
      },
      update: {
        lastSeenAt: new Date(),
        lastPostExternalId: account.postId,
        // No pisar WATCHING / IGNORED.
      },
    });
    count += 1;
  }
  return count;
}

export async function listWatchlist(
  tenantId: string,
  status?: WatchlistStatus,
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { anonymizationSalt: true, instagramHandle: true, twitterHandle: true },
  });
  const own = new Set(
    [tenant?.instagramHandle, tenant?.twitterHandle]
      .filter((handle): handle is string => Boolean(handle))
      .map((handle) => handle.trim().replace(/^@/, '').toLowerCase()),
  );

  const accounts = await prisma.watchlistAccount.findMany({
    where: {
      tenantId,
      reason: 'COMMENT_AUTHOR',
      ...(status ? { status } : {}),
    },
  });
  const commenters = accounts.filter((account) => !own.has(account.username));

  const activity = await commentActivity(
    tenantId,
    tenant?.anonymizationSalt ?? null,
    commenters,
  );

  return commenters
    .map((account) => {
      const stats = activity.get(`${account.network}:${account.username}`);
      const lastActiveAt = stats?.last ?? account.lastSeenAt;
      return {
        ...account,
        commentCount: stats?.count ?? 0,
        lastActiveAt,
      };
    })
    .sort((a, b) => {
      if (b.commentCount !== a.commentCount) return b.commentCount - a.commentCount;
      return b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
    });
}

async function commentActivity(
  tenantId: string,
  salt: string | null,
  accounts: { network: string; username: string }[],
) {
  const resolved = new Map<string, { count: number; last: Date | null }>();
  if (!salt || accounts.length === 0) return resolved;

  const networks = ['instagram', 'twitter'] as const;
  const grouped = await Promise.all(
    networks.map((network) =>
      prisma.comment.groupBy({
        by: ['authorHash'],
        where: {
          tenantId,
          authorHash: { not: null },
          post: { network },
        },
        _count: { _all: true },
        _max: { publishedAt: true },
      }),
    ),
  );

  const byHash = new Map<string, { count: number; last: Date | null }>();
  networks.forEach((network, index) => {
    for (const row of grouped[index] ?? []) {
      if (!row.authorHash) continue;
      byHash.set(`${network}:${row.authorHash}`, {
        count: row._count._all,
        last: row._max.publishedAt,
      });
    }
  });

  for (const account of accounts) {
    const hash = pseudonymizeAuthor(account.username, salt);
    const stats = byHash.get(`${account.network}:${hash}`);
    if (stats) resolved.set(`${account.network}:${account.username}`, stats);
  }
  return resolved;
}

export async function setWatchlistStatus(
  tenantId: string,
  id: string,
  status: WatchlistStatus,
) {
  const row = await prisma.watchlistAccount.findFirst({
    where: { id, tenantId },
  });
  if (!row) return null;

  const updated = await prisma.watchlistAccount.update({
    where: { id },
    data: { status },
  });

  if (status === 'WATCHING') {
    const value = `@${row.username}`;
    await prisma.scrapeTarget.upsert({
      where: {
        tenantId_type_value: { tenantId, type: 'ACCOUNT', value },
      },
      create: { tenantId, type: 'ACCOUNT', value, isActive: true },
      update: { isActive: true },
    });
  }

  return updated;
}
