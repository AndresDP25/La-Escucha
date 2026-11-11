/**
 * Búsqueda manual de Instagram para el municipio activo.
 * No programa nada: un clic, un tope de resultados y un tope de gasto.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authenticate, authorize, resolveTenantId } from '../../middlewares/auth';
import { AppError } from '../../shared/errors';
import { openSecret } from '../../shared/secret-box';
import {
  RESULTS_DEFAULT,
  RESULTS_MAX,
  RESULTS_MIN,
  listSearchAccounts,
  runTenantSearch,
} from './scraping.service';

async function userApifyToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apifyToken: true },
  });
  if (!user?.apifyToken) return null;
  try {
    const value = openSecret(user.apifyToken).trim();
    return value || null;
  } catch {
    return null;
  }
}

function requireUserApifyToken(token: string | null): string {
  if (!token) {
    throw new AppError(
      503,
      'Cargá tu clave de Apify en Ajustes → Perfil.',
      'APIFY_NOT_CONFIGURED',
    );
  }
  return token;
}

const BodySchema = z.object({
  resultsPerAccount: z.coerce
    .number()
    .int()
    .min(RESULTS_MIN)
    .max(RESULTS_MAX)
    .default(RESULTS_DEFAULT),
  network: z.enum(['instagram', 'twitter']).default('instagram'),
});

export async function scrapingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/scrape/targets',
    { preHandler: [authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR')] },
    async (request) => {
      const tenantId = resolveTenantId(request);
      const handles = await listSearchAccounts(tenantId);
      const token = request.currentUser
        ? await userApifyToken(request.currentUser.userId)
        : null;
      return {
        accounts: handles.instagram ? [handles.instagram] : [],
        instagram: handles.instagram,
        twitter: handles.twitter,
        apifyConfigured: Boolean(token),
      };
    },
  );

  app.post(
    '/scrape/run',
    { preHandler: [authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR')] },
    async (request) => {
      const tenantId = resolveTenantId(request);
      const { resultsPerAccount, network } = BodySchema.parse(request.body ?? {});
      const token = requireUserApifyToken(
        request.currentUser ? await userApifyToken(request.currentUser.userId) : null,
      );
      return runTenantSearch(tenantId, resultsPerAccount, network, token);
    },
  );
}
