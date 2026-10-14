/**
 * Construccion de la aplicacion Fastify (sin arrancar el listen).
 *
 * Separar `build` de `start` facilita los tests de integracion (se puede
 * instanciar la app sin abrir un puerto).
 */
import Fastify, {
  type FastifyInstance,
  type FastifyBaseLogger,
} from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/error-handler';

// Rutas
import { authRoutes } from './modules/auth/auth.routes';
import { ingestionRoutes } from './modules/ingestion/ingestion.routes';
import { keywordsRoutes } from './modules/keywords/keywords.routes';
import { tenantsRoutes } from './modules/tenants/tenants.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { watchlistRoutes } from './modules/watchlist/watchlist.routes';
import { scrapingRoutes } from './modules/scraping/scraping.routes';

export async function buildApp(): Promise<FastifyInstance> {
  // Casteamos el logger de pino a FastifyBaseLogger para que el tipo de la
  // instancia use el logger base y no filtre el tipo concreto de pino.
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
  });

  // --- Seguridad ---
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  // --- Captura del cuerpo CRUDO para verificar la firma HMAC del webhook ---
  // Guardamos el Buffer original en `request.rawBody` y ademas parseamos el JSON.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = body as Buffer;
      try {
        const json =
          (body as Buffer).length > 0
            ? JSON.parse((body as Buffer).toString('utf8'))
            : {};
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // --- Manejo de errores global ---
  app.setErrorHandler(errorHandler);

  // --- Healthcheck ---
  app.get('/health', async () => ({ status: 'ok' }));

  // --- Rutas de dominio ---
  await app.register(authRoutes);
  await app.register(ingestionRoutes);
  await app.register(keywordsRoutes);
  await app.register(tenantsRoutes);
  await app.register(analyticsRoutes);
  await app.register(watchlistRoutes);
  await app.register(scrapingRoutes);

  return app;
}
