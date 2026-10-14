/**
 * Rutas de administracion de municipios (tenants).
 *
 * Solo accesible por SUPER_ADMIN. Alta de un municipio nuevo = crear el tenant;
 * sus secretos (webhookSecret / anonymizationSalt) se generan automaticamente.
 */
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authenticate, authorize } from '../../middlewares/auth';
import { ConflictError, NotFoundError } from '../../shared/errors';

const CreateTenantSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'slug: solo minusculas, numeros y guiones'),
});

const PatchTenantSchema = z.object({
  isActive: z.boolean(),
});

export async function tenantsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // Listar tenants visibles: SUPER_ADMIN ve todos; el resto, solo el suyo.
  app.get('/tenants', async (request) => {
    const user = request.currentUser;
    const select = {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
    } as const;

    if (user?.role === 'SUPER_ADMIN') {
      return prisma.tenant.findMany({
        select,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });
    }

    if (!user?.tenantId) return [];
    return prisma.tenant.findMany({
      select,
      where: { id: user.tenantId, isActive: true },
    });
  });

  app.post('/tenants', { preHandler: authorize('SUPER_ADMIN') }, async (request, reply) => {
    const { name, slug } = CreateTenantSchema.parse(request.body);
    const existing = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (existing) {
      throw new ConflictError(
        existing.isActive
          ? 'Ya existe una cuenta con ese identificador (slug)'
          : 'Ese identificador ya existe pero está inactivo. Reactivalo desde la lista.',
      );
    }
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        webhookSecret: randomBytes(32).toString('hex'),
        anonymizationSalt: randomBytes(16).toString('hex'),
      },
      // Devolvemos el webhookSecret SOLO al crear, para configurar el proveedor.
      select: { id: true, name: true, slug: true, isActive: true, webhookSecret: true },
    });
    return reply.code(201).send(tenant);
  });

  app.patch<{ Params: { id: string } }>(
    '/tenants/:id',
    { preHandler: authorize('SUPER_ADMIN') },
    async (request) => {
      const { isActive } = PatchTenantSchema.parse(request.body);
      const { id } = request.params;
      const existing = await prisma.tenant.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('Cuenta no encontrada');
      return prisma.tenant.update({
        where: { id },
        data: { isActive },
        select: { id: true, name: true, slug: true, isActive: true },
      });
    },
  );
}
