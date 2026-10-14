/**
 * Búsqueda manual de Instagram para el municipio activo.
 * No programa nada: un clic, un tope de resultados y un tope de gasto.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, authorize, resolveTenantId } from '../../middlewares/auth';
import {
  RESULTS_DEFAULT,
  RESULTS_MAX,
  RESULTS_MIN,
  apifyConfigured,
  listSearchAccounts,
  runTenantSearch,
} from './scraping.service';

const BodySchema = z.object({
  resultsPerAccount: z.coerce
    .number()
    .int()
    .min(RESULTS_MIN)
    .max(RESULTS_MAX)
    .default(RESULTS_DEFAULT),
});

export async function scrapingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/scrape/targets',
    { preHandler: [authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR')] },
    async (request) => {
      const tenantId = resolveTenantId(request);
      const accounts = await listSearchAccounts(tenantId);
      return { accounts, apifyConfigured: apifyConfigured() };
    },
  );

  app.post(
    '/scrape/run',
    { preHandler: [authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR')] },
    async (request) => {
      const tenantId = resolveTenantId(request);
      const { resultsPerAccount } = BodySchema.parse(request.body ?? {});
      return runTenantSearch(tenantId, resultsPerAccount);
    },
  );
}
