/**
 * Lista paralela de cuentas descubiertas (watchlist).
 *
 * Un scrape NO las monitorea solas: quedan PENDING hasta que un ADMIN las
 * pase a WATCHING (ahi se crea un ScrapeTarget). Asi la lista no explota.
 */
import type { DiscoveryReason, WatchlistStatus } from '@prisma/client';
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
): Promise<number> {
  let count = 0;
  for (const account of accounts) {
    const username = account.username.trim().toLowerCase();
    if (!username) continue;

    await prisma.watchlistAccount.upsert({
      where: { tenantId_username: { tenantId, username } },
      create: {
        tenantId,
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
  return prisma.watchlistAccount.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { lastSeenAt: 'desc' },
  });
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
