/**
 * Wrapper sobre pg-boss, la cola de trabajos que usa PostgreSQL como backend.
 *
 * Decision de arquitectura: no introducimos Redis. pg-boss nos da colas
 * persistentes, reintentos y "dead-letter" usando la misma base de datos,
 * reduciendo infraestructura y costo operativo. Si el volumen creciera mucho,
 * se puede migrar a BullMQ sin tocar el resto del dominio.
 */
import PgBoss from 'pg-boss';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/** Nombres de las colas. Centralizados para evitar strings sueltos. */
export const QUEUE_NAMES = {
  /** Procesamiento NLP de un evento de ingesta ya persistido. */
  PROCESS_INGESTION: 'process-ingestion',
} as const;

/** Payload que viaja por la cola de procesamiento. */
export interface ProcessIngestionJob {
  /** Id del IngestionEvent a procesar. */
  ingestionEventId: string;
  /** Tenant dueno del evento (redundante pero util para trazas). */
  tenantId: string;
}

let boss: PgBoss | null = null;

/**
 * Inicializa (si hace falta) y devuelve la instancia de pg-boss.
 * Es idempotente: multiples llamadas comparten la misma instancia.
 */
export async function getQueue(): Promise<PgBoss> {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: env.QUEUE_SCHEMA,
  });

  boss.on('error', (error) => {
    logger.error({ error }, 'Error en la cola pg-boss');
  });

  await boss.start();
  logger.info('Cola pg-boss iniciada');
  return boss;
}

/** Cierra la conexion de la cola de forma ordenada. */
export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    logger.info('Cola pg-boss detenida');
  }
}

/** Encola un trabajo de procesamiento de ingesta. */
export async function enqueueProcessIngestion(
  job: ProcessIngestionJob,
): Promise<void> {
  const queue = await getQueue();
  await queue.send(QUEUE_NAMES.PROCESS_INGESTION, job, {
    // Reintentos con backoff exponencial ante fallos transitorios.
    retryLimit: 5,
    retryDelay: 10,
    retryBackoff: true,
  });
}
