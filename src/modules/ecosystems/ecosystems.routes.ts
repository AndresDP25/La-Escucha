/**
 * Ecosistemas: grupos de cuentas que se escuchan juntas.
 * El alta de cuentas sueltas no entra por acá. Un ecosistema se arma
 * con cuentas que ya existen.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authenticate, authorize } from '../../middlewares/auth';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';

const accountSelect = {
  id: true,
  name: true,
  slug: true,
  instagramHandle: true,
  twitterHandle: true,
} as const;

function slugFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function present(id: string) {
  const row = await prisma.ecosystem.findUnique({
    where: { id },
    include: {
      members: {
        include: { tenant: { select: accountSelect } },
        orderBy: { tenant: { name: 'asc' } },
      },
    },
  });
  if (!row) throw new NotFoundError('Ecosistema no encontrado');
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    accounts: row.members.map((member) => member.tenant),
  };
}

async function ensurePruebasTomi(): Promise<void> {
  const slug = 'pruebas-tomi';
  const existing = await prisma.ecosystem.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return;
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: ['ignacio-torres', 'ferantonijevic'] } },
    select: { id: true },
  });
  if (tenants.length === 0) return;
  const taken = await prisma.ecosystemMember.findMany({
    where: { tenantId: { in: tenants.map((tenant) => tenant.id) } },
    select: { tenantId: true },
  });
  const takenIds = new Set(taken.map((row) => row.tenantId));
  const free = tenants.filter((tenant) => !takenIds.has(tenant.id));
  if (free.length === 0) return;
  await prisma.tenant.updateMany({
    where: { id: { in: free.map((tenant) => tenant.id) } },
    data: { isActive: true },
  });
  await prisma.ecosystem.create({
    data: {
      name: 'Pruebas Tomi',
      slug,
      members: { create: free.map((tenant) => ({ tenantId: tenant.id })) },
    },
  });
}

async function ensureStarterEcosystems(): Promise<void> {
  const existing = await prisma.ecosystem.count();
  if (existing > 0) return;

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true },
  });
  const bySlug = new Map(tenants.map((tenant) => [tenant.slug, tenant.id]));
  const groups = [
    { name: 'PRO', slug: 'pro', members: ['pro-argentina', 'pro-ciudad'] },
    { name: 'San Fernando', slug: 'san-fernando-eco', members: ['san-fernando'] },
    { name: 'Pruebas Tomi', slug: 'pruebas-tomi', members: ['ignacio-torres', 'ferantonijevic'] },
  ];

  for (const group of groups) {
    const tenantIds = group.members
      .map((slug) => bySlug.get(slug))
      .filter((id): id is string => Boolean(id));
    if (tenantIds.length === 0) continue;
    await prisma.ecosystem.create({
      data: {
        name: group.name,
        slug: group.slug,
        members: { create: tenantIds.map((tenantId) => ({ tenantId })) },
      },
    });
  }
}

const WriteSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tenantIds: z.array(z.string().uuid()).min(1).max(12),
});

async function assertFreeAccounts(tenantIds: string[], exceptEcosystemId?: string): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds }, isActive: true },
    select: { id: true },
  });
  if (tenants.length !== tenantIds.length) {
    throw new ValidationError('Alguna cuenta no está disponible');
  }
  const taken = await prisma.ecosystemMember.findMany({
    where: {
      tenantId: { in: tenantIds },
      ...(exceptEcosystemId ? { ecosystemId: { not: exceptEcosystemId } } : {}),
    },
    select: { tenantId: true },
  });
  if (taken.length > 0) {
    throw new ConflictError('Esa cuenta ya está en otro ecosistema');
  }
}

export async function ecosystemsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/ecosystems', async (request) => {
    await ensureStarterEcosystems();
    await ensurePruebasTomi();
    const user = request.currentUser;
    const rows = await prisma.ecosystem.findMany({
      where:
        user?.role === 'SUPER_ADMIN' || !user?.tenantId
          ? undefined
          : { members: { some: { tenantId: user.tenantId } } },
      orderBy: { name: 'asc' },
      include: {
        members: {
          include: { tenant: { select: accountSelect } },
          orderBy: { tenant: { name: 'asc' } },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      accounts: row.members.map((member) => member.tenant),
    }));
  });

  app.post('/ecosystems', { preHandler: authorize('SUPER_ADMIN') }, async (request, reply) => {
    const data = WriteSchema.parse(request.body);
    const slug = slugFromName(data.name);
    if (!slug) throw new ValidationError('El nombre no sirve como identificador');
    const clash = await prisma.ecosystem.findUnique({ where: { slug }, select: { id: true } });
    if (clash) throw new ConflictError('Ya hay un ecosistema con ese nombre');
    await assertFreeAccounts(data.tenantIds);
    const created = await prisma.ecosystem.create({
      data: {
        name: data.name,
        slug,
        members: { create: data.tenantIds.map((tenantId) => ({ tenantId })) },
      },
    });
    return reply.code(201).send(await present(created.id));
  });

  app.patch<{ Params: { id: string } }>(
    '/ecosystems/:id',
    { preHandler: authorize('SUPER_ADMIN') },
    async (request) => {
      const data = WriteSchema.parse(request.body);
      const current = await prisma.ecosystem.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });
      if (!current) throw new NotFoundError('Ecosistema no encontrado');
      await assertFreeAccounts(data.tenantIds, current.id);
      await prisma.$transaction([
        prisma.ecosystem.update({
          where: { id: current.id },
          data: { name: data.name },
        }),
        prisma.ecosystemMember.deleteMany({ where: { ecosystemId: current.id } }),
        prisma.ecosystemMember.createMany({
          data: data.tenantIds.map((tenantId) => ({ ecosystemId: current.id, tenantId })),
        }),
      ]);
      return present(current.id);
    },
  );
}
