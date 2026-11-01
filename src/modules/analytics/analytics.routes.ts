/**
 * Rutas de analitica para el dashboard.
 *
 * Devuelve agregados (por categoria, por sentimiento) y un listado paginado de
 * comentarios, siempre acotados al tenant. Accesible por cualquier usuario
 * autenticado (incluye VIEWER).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authenticate, authorize, resolveTenantId } from '../../middlewares/auth';
import { ValidationError, NotFoundError } from '../../shared/errors';
import { createClassifier } from '../../core/classifier/classifier.factory';
import { processText } from '../../core/text/text-processor';
import { buildCompareRows, COMPARE_THEMES } from './compare';

const CommentsQuerySchema = z.object({
  category: z
    .enum([
      'SECURITY',
      'PUBLIC_WORKS',
      'HEALTH',
      'POLITICS',
      'SUPPORT',
      'ENGAGEMENT',
      'ATTACK',
      'OTHER',
    ])
    .optional(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // Resumen agregado: totales por categoria y por sentimiento.
  app.get('/analytics/summary', async (request) => {
    const tenantId = resolveTenantId(request);

    const [byCategory, bySentiment, total, posts] = await Promise.all([
      prisma.comment.groupBy({
        by: ['category'],
        where: { tenantId },
        _count: { _all: true },
      }),
      prisma.comment.groupBy({
        by: ['sentiment'],
        where: { tenantId },
        _count: { _all: true },
      }),
      prisma.comment.count({ where: { tenantId } }),
      prisma.post.count({ where: { tenantId } }),
    ]);

    return {
      total,
      posts,
      byCategory: byCategory.map((row) => ({
        category: row.category,
        count: row._count._all,
      })),
      bySentiment: bySentiment.map((row) => ({
        sentiment: row.sentiment,
        count: row._count._all,
      })),
    };
  });

  // Listado paginado de comentarios (filtrable).
  app.get('/analytics/comments', async (request) => {
    const tenantId = resolveTenantId(request);
    const { category, sentiment, page, pageSize } = CommentsQuerySchema.parse(
      request.query,
    );

    const where = {
      tenantId,
      ...(category ? { category } : {}),
      ...(sentiment ? { sentiment } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          cleanText: true,
          category: true,
          sentiment: true,
          isAnonymized: true,
          emojis: true,
          likeCount: true,
          publishedAt: true,
          post: {
            select: {
              caption: true,
              url: true,
              authorRef: true,
            },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((row) => ({
        ...row,
        post: {
          caption: row.post.caption,
          url: row.post.url,
          ownerUsername: row.post.authorRef,
        },
      })),
    };
  });

  app.get('/analytics/posts', async (request) => {
    const tenantId = resolveTenantId(request);

    const items = await prisma.post.findMany({
      where: { tenantId },
      orderBy: { publishedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        network: true,
        externalId: true,
        caption: true,
        url: true,
        authorRef: true,
        publishedAt: true,
        comments: {
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true,
            rawText: true,
            cleanText: true,
            category: true,
            sentiment: true,
            isAnonymized: true,
            emojis: true,
            likeCount: true,
            publishedAt: true,
          },
        },
      },
    });

    const hasTweets = items.some(
      (row) => row.network === 'twitter' && row.caption?.trim() && !row.externalId.startsWith('replies-'),
    );
    const classifier = hasTweets
      ? createClassifier(
          await prisma.keywordConfig.findMany({
            where: { tenantId, isActive: true },
          }),
        )
      : null;

    const mapped = [];
    for (const row of items) {
      let category: string | undefined;
      let sentiment: string | undefined;
      if (
        classifier &&
        row.network === 'twitter' &&
        row.caption?.trim() &&
        !row.externalId.startsWith('replies-')
      ) {
        const processed = processText(row.caption);
        const result = await classifier.classify({
          normalizedText: processed.normalized,
          cleanText: processed.clean,
        });
        category = result.category;
        sentiment = result.sentiment;
      }
      mapped.push({
        id: row.id,
        network: row.network,
        caption: row.caption,
        url: row.url,
        ownerUsername: row.authorRef,
        publishedAt: row.publishedAt,
        category,
        sentiment,
        comments: row.comments,
      });
    }

    return { items: mapped };
  });

  // Comparación entre cuentas. Solo quien administra todas.
  // Los comentarios no se copian: se leen en el tenant donde se guardaron.
  app.get(
    '/analytics/compare',
    { preHandler: authorize('SUPER_ADMIN') },
    async (request) => {
      const { ids: rawIds, network } = z
        .object({
          ids: z.string().optional().default(''),
          network: z.enum(['instagram', 'twitter']).optional(),
        })
        .parse(request.query);
      const ids = [
        ...new Set(
          rawIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ];
      const parsed = z.array(z.string().uuid()).max(12).safeParse(ids);
      if (!parsed.success) {
        throw new ValidationError('Las cuentas a comparar no son válidas.');
      }

      if (parsed.data.length === 0) {
        return { accounts: [], categories: buildCompareRows([], []) };
      }

      const accounts = await prisma.tenant.findMany({
        where: { id: { in: parsed.data }, isActive: true },
        select: { id: true, name: true, instagramHandle: true, twitterHandle: true },
        orderBy: { name: 'asc' },
      });
      const accountIds = accounts.map((account) => account.id);
      const grouped = await prisma.comment.groupBy({
        by: ['tenantId', 'category'],
        where: {
          tenantId: { in: accountIds },
          ...(network ? { post: { network } } : {}),
        },
        _count: { _all: true },
      });

      return {
        accounts,
        categories: buildCompareRows(
          accountIds,
          grouped.map((row) => ({
            tenantId: row.tenantId,
            category: row.category,
            count: row._count._all,
          })),
        ),
      };
    },
  );

  app.get(
    '/analytics/compare/comments',
    { preHandler: authorize('SUPER_ADMIN') },
    async (request) => {
      const { tenantId, category, network } = z
        .object({
          tenantId: z.string().uuid(),
          category: z.enum(COMPARE_THEMES),
          network: z.enum(['instagram', 'twitter']).optional(),
        })
        .parse(request.query);

      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, isActive: true },
        select: { id: true, name: true, instagramHandle: true, twitterHandle: true },
      });
      if (!tenant) throw new NotFoundError('Esa cuenta no está disponible.');

      const items = await prisma.comment.findMany({
        where: {
          tenantId,
          category,
          ...(network ? { post: { network } } : {}),
        },
        orderBy: { publishedAt: 'desc' },
        take: 40,
        select: {
          id: true,
          rawText: true,
          cleanText: true,
          emojis: true,
          sentiment: true,
          isAnonymized: true,
          publishedAt: true,
          post: {
            select: { caption: true, url: true, authorRef: true },
          },
        },
      });

      return {
        account: tenant,
        category,
        items: items.map((row) => ({
          id: row.id,
          text: row.rawText?.trim() || row.cleanText,
          emojis: row.emojis,
          sentiment: row.sentiment,
          isAnonymized: row.isAnonymized,
          publishedAt: row.publishedAt,
          post: {
            caption: row.post.caption,
            url: row.post.url,
            ownerUsername: row.post.authorRef,
          },
        })),
      };
    },
  );
}
