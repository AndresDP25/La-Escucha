/**
 * Pipeline de procesamiento de un evento de ingesta.
 *
 * Etapas por cada comentario:
 *   1. Normalizar / limpiar texto (emojis, stop-words).
 *   2. Clasificar categoria + sentimiento (clasificador del tenant).
 *   3. Aplicar politica de privacidad (pseudonimizar o anonimizar).
 *   4. Persistir Post y Comment de forma idempotente (upsert).
 *
 * Se ejecuta en el worker, no en el request HTTP. Marca el IngestionEvent como
 * PROCESSED o ERROR al finalizar.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { logger } from '../../config/logger';
import { processText } from '../../core/text/text-processor';
import { applyPrivacyPolicy } from '../../core/privacy/anonymizer';
import { createClassifier } from '../../core/classifier/classifier.factory';
import {
  IngestionPayloadSchema,
  type RawPost,
} from '../ingestion/ingestion.schema';

/** Procesa un IngestionEvent por su id. */
export async function processIngestionEvent(
  ingestionEventId: string,
): Promise<void> {
  const event = await prisma.ingestionEvent.findUnique({
    where: { id: ingestionEventId },
  });

  if (!event) {
    logger.warn({ ingestionEventId }, 'IngestionEvent inexistente; se omite');
    return;
  }

  if (event.status === 'PROCESSED') {
    logger.info({ ingestionEventId }, 'IngestionEvent ya procesado; se omite');
    return;
  }

  // Marcar como PROCESSING.
  await prisma.ingestionEvent.update({
    where: { id: event.id },
    data: { status: 'PROCESSING' },
  });

  try {
    // Revalidar el crudo (defensivo).
    const payload = IngestionPayloadSchema.parse(event.rawPayload);

    // Cargar contexto del tenant: sal + keywords -> clasificador.
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: event.tenantId },
      select: { anonymizationSalt: true },
    });
    const keywords = await prisma.keywordConfig.findMany({
      where: { tenantId: event.tenantId, isActive: true },
    });
    const classifier = createClassifier(keywords);

    const network = payload.network ?? 'instagram';
    let commentsProcessed = 0;
    for (const rawPost of payload.posts) {
      const post = await upsertPost(event.tenantId, rawPost, network);

      for (const rawComment of rawPost.comments) {
        // 1) Limpieza de texto.
        const processed = processText(rawComment.text);

        // 2) Clasificacion.
        const classification = await classifier.classify({
          normalizedText: processed.normalized,
          cleanText: processed.clean,
        });

        // 3) Privacidad.
        const privacy = applyPrivacyPolicy({
          username: rawComment.ownerUsername ?? null,
          rawText: rawComment.text,
          cleanText: processed.clean,
          tenantSalt: tenant.anonymizationSalt,
          isSensitive: classification.isSensitive,
        });

        // 4) Persistencia idempotente.
        await prisma.comment.upsert({
          where: {
            tenantId_externalId: {
              tenantId: event.tenantId,
              externalId: rawComment.id,
            },
          },
          create: {
            tenantId: event.tenantId,
            postId: post.id,
            externalId: rawComment.id,
            authorHash: privacy.authorHash,
            isAnonymized: privacy.isAnonymized,
            isSensitive: classification.isSensitive,
            rawText: privacy.rawText,
            cleanText: privacy.cleanText,
            emojis: processed.emojis,
            category: classification.category,
            sentiment: classification.sentiment,
            likeCount: rawComment.likesCount ?? null,
            publishedAt: rawComment.timestamp
              ? new Date(rawComment.timestamp)
              : null,
          },
          // Si ya existe, re-aplicamos la clasificacion/privacidad actual.
          update: {
            authorHash: privacy.authorHash,
            isAnonymized: privacy.isAnonymized,
            isSensitive: classification.isSensitive,
            rawText: privacy.rawText,
            cleanText: privacy.cleanText,
            emojis: processed.emojis,
            category: classification.category,
            sentiment: classification.sentiment,
          },
        });

        commentsProcessed += 1;
      }
    }

    await prisma.ingestionEvent.update({
      where: { id: event.id },
      data: { status: 'PROCESSED', processedAt: new Date(), error: null },
    });

    logger.info(
      { ingestionEventId: event.id, commentsProcessed },
      'IngestionEvent procesado',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.ingestionEvent.update({
      where: { id: event.id },
      data: { status: 'ERROR', error: message },
    });
    logger.error(
      { ingestionEventId: event.id, error: message },
      'Error procesando IngestionEvent',
    );
    // Relanzar para que pg-boss reintente segun la politica configurada.
    throw error;
  }
}

/** Crea o actualiza el Post normalizado de forma idempotente. */
async function upsertPost(
  tenantId: string,
  rawPost: RawPost,
  network: 'instagram' | 'twitter',
): Promise<{ id: string }> {
  const data: Prisma.PostUncheckedCreateInput = {
    tenantId,
    network,
    externalId: rawPost.id,
    url: rawPost.url ?? null,
    authorRef: rawPost.ownerUsername ?? null,
    caption: rawPost.caption ?? null,
    publishedAt: rawPost.timestamp ? new Date(rawPost.timestamp) : null,
    raw: rawPost as unknown as Prisma.InputJsonValue,
  };

  return prisma.post.upsert({
    where: {
      tenantId_network_externalId: {
        tenantId,
        network,
        externalId: rawPost.id,
      },
    },
    create: data,
    update: {
      url: data.url,
      caption: data.caption,
      publishedAt: data.publishedAt,
      raw: data.raw,
    },
    select: { id: true },
  });
}
