/**
 * Búsqueda manual de Instagram para el municipio activo.
 * No programa nada: un clic, un tope de resultados y un tope de gasto.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { authenticate, authorize, resolveTenantId } from '../../middlewares/auth';
import { NotFoundError } from '../../shared/errors';
import {
  createScrapeRun,
  failScrapeRun,
  finishScrapeRun,
  pushScrapeStep,
  readScrapeRun,
} from './scrape-runs';
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
      return {
        accounts: handles.instagram ? [handles.instagram] : [],
        instagram: handles.instagram,
        twitter: handles.twitter,
        apifyConfigured: apifyConfigured(),
      };
    },
  );

  app.post(
    '/scrape/run',
    { preHandler: [authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const tenantId = resolveTenantId(request);
      const { resultsPerAccount, network } = BodySchema.parse(request.body ?? {});
      const id = createScrapeRun(tenantId);
      void runTenantSearch(tenantId, resultsPerAccount, network, (text) => pushScrapeStep(id, text))
        .then((result) => finishScrapeRun(id, result))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'No se pudo buscar';
          logger.error({ err, scrapeRunId: id }, 'Falló la búsqueda');
          failScrapeRun(id, message);
        });
      return reply.code(202).send({ id });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/scrape/runs/:id',
    { preHandler: [authorize('ADMIN', 'SUPER_ADMIN', 'OPERATOR')] },
    async (request) => {
      const tenantId = resolveTenantId(request);
      const run = readScrapeRun(request.params.id, tenantId);
      if (!run) throw new NotFoundError('Búsqueda no encontrada');
      return run;
    },
  );
}
