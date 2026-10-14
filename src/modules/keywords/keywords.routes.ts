/**
 * Rutas de configuracion de keywords por municipio (diccionario dinamico).
 *
 * Todas las operaciones estan acotadas al tenant resuelto (`resolveTenantId`),
 * de modo que un municipio nunca puede ver ni tocar las keywords de otro.
 *
 * Permisos: ADMIN del tenant o SUPER_ADMIN.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import {
  authenticate,
  authorize,
  resolveTenantId,
} from '../../middlewares/auth';
import { NotFoundError } from '../../shared/errors';

const CategoryEnum = z.enum([
  'SECURITY',
  'PUBLIC_WORKS',
  'HEALTH',
  'POLITICS',
  'SUPPORT',
  'ENGAGEMENT',
  'ATTACK',
  'OTHER',
]);

const CreateKeywordSchema = z.object({
  category: CategoryEnum,
  pattern: z.string().min(1),
  matchType: z.enum(['LITERAL', 'REGEX']).default('LITERAL'),
  weight: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
});

export async function keywordsRoutes(app: FastifyInstance): Promise<void> {
  // Todas las rutas requieren autenticacion y rol de administracion.
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN', 'SUPER_ADMIN'));

  // Listar keywords del tenant.
  app.get('/keywords', async (request) => {
    const tenantId = resolveTenantId(request);
    return prisma.keywordConfig.findMany({
      where: { tenantId },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    });
  });

  // Crear keyword.
  app.post('/keywords', async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const data = CreateKeywordSchema.parse(request.body);
    const created = await prisma.keywordConfig.create({
      data: { ...data, tenantId },
    });
    return reply.code(201).send(created);
  });

  // Eliminar keyword (solo si pertenece al tenant).
  app.delete<{ Params: { id: string } }>(
    '/keywords/:id',
    async (request, reply) => {
      const tenantId = resolveTenantId(request);
      const { id } = request.params;

      const existing = await prisma.keywordConfig.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('Keyword no encontrada');

      await prisma.keywordConfig.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
}
