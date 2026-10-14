/**
 * Worker de procesamiento.
 *
 * Proceso separado de la API: consume la cola pg-boss y ejecuta el pipeline NLP
 * sobre cada evento de ingesta. Escalarlo horizontalmente (mas instancias) es
 * tan simple como levantar mas copias de este proceso.
 */
import { logger } from './config/logger';
import {
  getQueue,
  stopQueue,
  QUEUE_NAMES,
  type ProcessIngestionJob,
} from './core/queue/queue';
import { processIngestionEvent } from './modules/processing/processing.service';
import { prisma } from './db/prisma';

async function main(): Promise<void> {
  const boss = await getQueue();

  await boss.work<ProcessIngestionJob>(
    QUEUE_NAMES.PROCESS_INGESTION,
    async (job) => {
      logger.info(
        { jobId: job.id, ...job.data },
        'Procesando evento de ingesta',
      );
      await processIngestionEvent(job.data.ingestionEventId);
    },
  );

  logger.info('Worker de procesamiento iniciado');

  // Apagado ordenado.
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Apagando worker...');
    await stopQueue();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'Fallo al iniciar el worker');
  process.exit(1);
});
