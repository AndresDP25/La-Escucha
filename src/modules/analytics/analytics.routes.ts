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
import { authenticate, resolveTenantId } from '../../middlewares/auth';

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
      take: 50,
      select: {
        id: true,
        caption: true,
        url: true,
        authorRef: true,
        publishedAt: true,
        comments: {
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true,
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

    return {
      items: items.map((row) => ({
        id: row.id,
        caption: row.caption,
        url: row.url,
        ownerUsername: row.authorRef,
        publishedAt: row.publishedAt,
        comments: row.comments,
      })),
    };
  });
}
