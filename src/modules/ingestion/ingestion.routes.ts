/**
 * Rutas de ingesta (webhook).
 *
 * POST /webhooks/ingest/:slug
 *   - :slug identifica al municipio (tenant).
 *   - Header x-signature: HMAC-SHA256 del cuerpo crudo con el webhookSecret.
 *   - Body: payload del scraper (ver ingestion.schema.ts).
 *
 * Responde 202 Accepted apenas persiste el crudo; el procesamiento NLP ocurre
 * luego en el worker.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma';
import { IngestionPayloadSchema } from './ingestion.schema';
import { ingestPayload } from './ingestion.service';
import { isApifyDataset, mapApifyDataset } from './apify.mapper';
import { upsertDiscoveredAccounts } from '../watchlist/watchlist.service';
import { SIGNATURE_HEADER, verifySignature } from './signature';
import { ValidationError } from '../../shared/errors';

/** Request con el cuerpo crudo capturado por el content-type parser. */
interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer;
}

export async function ingestionRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { slug: string } }>(
    '/webhooks/ingest/:slug',
    async (request, reply) => {
      const { slug } = request.params;

      // 1) Resolver el tenant por slug.
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, webhookSecret: true, isActive: true },
      });

      if (!tenant || !tenant.isActive) {
        // No revelamos si el tenant existe o no: respondemos 401 generico.
        return reply.code(401).send({ error: 'Firma o tenant invalido' });
      }

      // 2) Verificar la firma HMAC sobre el cuerpo crudo.
      const rawBody = (request as RawBodyRequest).rawBody ?? Buffer.alloc(0);
      const signature = request.headers[SIGNATURE_HEADER] as string | undefined;

      if (!verifySignature(rawBody, tenant.webhookSecret, signature)) {
        return reply.code(401).send({ error: 'Firma o tenant invalido' });
      }

      // 3) Validar el payload (canonico o dataset crudo de Apify).
      const runId = request.headers['x-apify-run-id'] as string | undefined;
      let payload;
      let discoveredCount = 0;

      if (isApifyDataset(request.body)) {
        const mapped = mapApifyDataset(request.body, runId);
        payload = mapped.payload;
        discoveredCount = await upsertDiscoveredAccounts(
          tenant.id,
          mapped.discoveredAccounts,
        );
      } else {
        const parsed = IngestionPayloadSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(
            'Payload invalido: ' +
              JSON.stringify(parsed.error.flatten().fieldErrors),
          );
        }
        payload = parsed.data;
      }

      // 4) Persistir crudo + encolar. Responder rapido.
      const result = await ingestPayload(tenant.id, payload);

      return reply.code(202).send({
        accepted: true,
        duplicated: result.duplicated,
        ingestionEventId: result.ingestionEventId,
        posts: payload.posts.length,
        comments: payload.posts.reduce((n, p) => n + p.comments.length, 0),
        discoveredCount,
      });
    },
  );
}
