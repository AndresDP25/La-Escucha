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
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { normalizeHandle, normalizeTwitterHandle } from '../scraping/scraping.service';

const CreateTenantSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'slug: solo minusculas, numeros y guiones'),
  instagram: z.string().trim().min(1).max(200),
  twitter: z.string().trim().max(200).optional(),
});

const PatchTenantSchema = z
  .object({
    isActive: z.boolean().optional(),
    instagram: z.string().trim().min(1).max(200).optional(),
    twitter: z.string().trim().max(200).nullable().optional(),
  })
  .refine((value) => value.isActive !== undefined || value.twitter !== undefined || value.instagram !== undefined, {
    message: 'Nada para actualizar',
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
      instagramHandle: true,
      twitterHandle: true,
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
    const { name, slug, instagram, twitter } = CreateTenantSchema.parse(request.body);
    const instagramHandle = normalizeHandle(instagram);
    const twitterHandle = twitter ? normalizeTwitterHandle(twitter) : null;
    if (twitter && !twitterHandle) {
      throw new ValidationError('El Twitter tiene que ser un usuario, por ejemplo proargentina.');
    }
    if (!instagramHandle) {
      throw new ValidationError(
        'El Instagram tiene que ser un usuario, por ejemplo sanfermunicipio.',
      );
    }
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
        instagramHandle,
        twitterHandle,
        webhookSecret: randomBytes(32).toString('hex'),
        anonymizationSalt: randomBytes(16).toString('hex'),
      },
      // Devolvemos el webhookSecret SOLO al crear, para configurar el proveedor.
      select: {
        id: true,
        name: true,
        slug: true,
        instagramHandle: true,
        twitterHandle: true,
        isActive: true,
        webhookSecret: true,
      },
    });
    return reply.code(201).send(tenant);
  });

  app.patch<{ Params: { id: string } }>(
    '/tenants/:id',
    { preHandler: authorize('SUPER_ADMIN') },
    async (request) => {
      const body = PatchTenantSchema.parse(request.body);
      const { id } = request.params;
      const existing = await prisma.tenant.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('Cuenta no encontrada');
      const twitterHandle =
        body.twitter === undefined
          ? undefined
          : body.twitter
            ? normalizeTwitterHandle(body.twitter)
            : null;
      if (body.twitter && !twitterHandle) {
        throw new ValidationError('El Twitter tiene que ser un usuario, por ejemplo proargentina.');
      }
      const instagramHandle = body.instagram ? normalizeHandle(body.instagram) : undefined;
      if (body.instagram && !instagramHandle) {
        throw new ValidationError('El Instagram tiene que ser un usuario, por ejemplo proargentina.');
      }
      return prisma.tenant.update({
        where: { id },
        data: {
          ...(body.isActive === undefined ? {} : { isActive: body.isActive }),
          ...(instagramHandle === undefined ? {} : { instagramHandle }),
          ...(twitterHandle === undefined ? {} : { twitterHandle }),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          instagramHandle: true,
          twitterHandle: true,
          isActive: true,
        },
      });
    },
  );
}
