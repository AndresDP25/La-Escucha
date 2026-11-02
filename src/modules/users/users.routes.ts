/**
 * Alta y listado de usuarios del sistema.
 * Solo el SUPER_ADMIN puede verlos y crearlos.
 */
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Role } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { authenticate, authorize } from '../../middlewares/auth';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';

const RoleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER']);

const CreateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(6).max(200),
  role: RoleSchema,
  tenantId: z.string().uuid().nullable().optional(),
});

const PatchUserSchema = z
  .object({
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.isActive !== undefined, {
    message: 'Nada para actualizar',
  });

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  tenantId: true,
  tenant: { select: { name: true } },
} as const;

function present(user: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  tenantId: string | null;
  tenant: { name: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    tenantId: user.tenantId,
    tenantName: user.tenant?.name ?? null,
  };
}

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('SUPER_ADMIN'));

  app.get('/users', async () => {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
    return users.map(present);
  });

  app.post('/users', async (request, reply) => {
    const body = CreateUserSchema.parse(request.body);
    const email = body.email.toLowerCase();
    const tenantId = body.role === 'SUPER_ADMIN' ? null : body.tenantId ?? null;
    if (body.role !== 'SUPER_ADMIN' && !tenantId) {
      throw new ValidationError('Ese rol tiene que pertenecer a una cuenta.');
    }
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });
      if (!tenant) throw new NotFoundError('Cuenta no encontrada');
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) throw new ConflictError('Ya existe un usuario con ese correo');

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        fullName: body.fullName,
        role: body.role,
        tenantId,
        passwordHash,
      },
      select: userSelect,
    });
    return reply.code(201).send(present(user));
  });

  app.patch<{ Params: { id: string } }>('/users/:id', async (request) => {
    const body = PatchUserSchema.parse(request.body);
    const existing = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Usuario no encontrado');
    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: { isActive: body.isActive },
      select: userSelect,
    });
    return present(user);
  });
}
