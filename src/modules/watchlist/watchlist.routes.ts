/**
 * Watchlist: cuentas descubiertas. ADMIN / SUPER_ADMIN / OPERATOR pueden ver;
 * solo ADMIN y SUPER_ADMIN cambian el estado.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  authenticate,
  authorize,
  resolveTenantId,
} from '../../middlewares/auth';
import { NotFoundError } from '../../shared/errors';
import { listWatchlist, setWatchlistStatus } from './watchlist.service';

const StatusQuery = z.enum(['PENDING', 'WATCHING', 'IGNORED']).optional();
const PatchBody = z.object({
  status: z.enum(['PENDING', 'WATCHING', 'IGNORED']),
});

export async function watchlistRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/watchlist', async (request) => {
    const tenantId = resolveTenantId(request);
    const parsed = z.object({ status: StatusQuery }).parse(request.query);
    return listWatchlist(tenantId, parsed.status);
  });

  app.patch<{ Params: { id: string } }>(
    '/watchlist/:id',
    { preHandler: [authorize('ADMIN', 'SUPER_ADMIN')] },
    async (request) => {
      const tenantId = resolveTenantId(request);
      const { status } = PatchBody.parse(request.body);
      const updated = await setWatchlistStatus(tenantId, request.params.id, status);
      if (!updated) throw new NotFoundError('Cuenta no encontrada');
      return updated;
    },
  );
}
