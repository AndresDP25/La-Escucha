/**
 * Rutas de autenticacion.
 *
 * POST /auth/login -> { email, password } => { token, user }
 */
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authenticate, signToken } from '../../middlewares/auth';
import { UnauthorizedError } from '../../shared/errors';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = LoginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { name: true, slug: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const token = signToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return reply.send({
      token,
      user: serializeUser(user),
    });
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request) => {
    const current = request.currentUser;
    if (!current) throw new UnauthorizedError();

    const user = await prisma.user.findUnique({
      where: { id: current.userId },
      include: { tenant: { select: { name: true, slug: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedError();
    return { user: serializeUser(user) };
  });
}

function serializeUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string | null;
  tenant: { name: string; slug: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    tenantId: user.tenantId,
    tenantName: user.tenant?.name ?? 'Sin cuenta',
    tenantSlug: user.tenant?.slug ?? null,
  };
}
