/**
 * Punto de entrada de la API HTTP.
 *
 * Arranca Fastify, inicializa la cola (para poder encolar desde la ingesta) y
 * maneja un apagado ordenado (graceful shutdown).
 */
import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { getQueue, stopQueue } from './core/queue/queue';
import { prisma } from './db/prisma';

async function main(): Promise<void> {
  // Inicializar la cola antes de aceptar trafico (la ingesta encola trabajos).
  await getQueue();

  const app = await buildApp();

  await app.listen({ host: env.HTTP_HOST, port: env.HTTP_PORT });
  logger.info(`API escuchando en http://${env.HTTP_HOST}:${env.HTTP_PORT}`);

  // Apagado ordenado.
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Apagando API...');
    await app.close();
    await stopQueue();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'Fallo al iniciar la API');
  process.exit(1);
});
