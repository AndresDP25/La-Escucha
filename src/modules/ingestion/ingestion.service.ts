/**
 * Servicio de ingesta.
 *
 * Responsabilidad: persistir el payload CRUDO de forma idempotente y encolar su
 * procesamiento asincrono. NO procesa aqui (eso lo hace el worker), para
 * responder rapido al proveedor y aguantar picos de miles de comentarios.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { logger } from '../../config/logger';
import { enqueueProcessIngestion } from '../../core/queue/queue';
import type { IngestionPayload } from './ingestion.schema';

export interface IngestionResult {
  ingestionEventId: string;
  /** true si el evento ya existia (reintento) y no se duplico. */
  duplicated: boolean;
}

/**
 * Registra un evento de ingesta para un tenant y lo encola para procesar.
 *
 * Idempotencia: la clave (tenantId, source, externalId) es unica. Si el evento
 * ya existe, no se vuelve a crear ni a encolar.
 */
export async function ingestPayload(
  tenantId: string,
  payload: IngestionPayload,
): Promise<IngestionResult> {
  // Buscar si ya existe (reintento del proveedor).
  const existing = await prisma.ingestionEvent.findUnique({
    where: {
      tenantId_source_externalId: {
        tenantId,
        source: payload.source,
        externalId: payload.externalId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    logger.info(
      { tenantId, externalId: payload.externalId },
      'Evento de ingesta duplicado; se ignora',
    );
    return { ingestionEventId: existing.id, duplicated: true };
  }

  // Persistir el crudo tal cual.
  const event = await prisma.ingestionEvent.create({
    data: {
      tenantId,
      source: payload.source,
      externalId: payload.externalId,
      // Guardamos el payload completo sin transformar.
      rawPayload: payload as unknown as Prisma.InputJsonValue,
      status: 'RECEIVED',
    },
    select: { id: true },
  });

  // Encolar el procesamiento asincrono.
  await enqueueProcessIngestion({ ingestionEventId: event.id, tenantId });

  logger.info(
    { tenantId, ingestionEventId: event.id, posts: payload.posts.length },
    'Evento de ingesta recibido y encolado',
  );

  return { ingestionEventId: event.id, duplicated: false };
}
