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
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { openSecret, sealSecret } from '../../shared/secret-box';

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

  app.get('/auth/apify-token', { preHandler: authenticate }, async (request) => {
    const current = request.currentUser;
    if (!current) throw new UnauthorizedError();
    return apifyStatus(current.userId);
  });

  app.put('/auth/apify-token', { preHandler: authenticate }, async (request) => {
    const current = request.currentUser;
    if (!current) throw new UnauthorizedError();
    const body = z
      .object({ token: z.string().max(300) })
      .parse(request.body);
    const token = body.token.trim();
    if (token && token.length < 8) {
      throw new ValidationError('Esa clave es demasiado corta.');
    }
    await prisma.user.update({
      where: { id: current.userId },
      data: { apifyToken: token ? sealSecret(token) : null },
    });
    return apifyStatus(current.userId);
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

async function apifyStatus(userId: string): Promise<{ configured: boolean; hint: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apifyToken: true },
  });
  if (!user?.apifyToken) return { configured: false, hint: null };
  try {
    const value = openSecret(user.apifyToken).trim();
    if (!value) return { configured: false, hint: null };
    return { configured: true, hint: `····${value.slice(-4)}` };
  } catch {
    return { configured: false, hint: null };
  }
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
