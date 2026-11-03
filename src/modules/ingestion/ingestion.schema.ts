/**
 * Esquemas de validacion (Zod) del payload crudo que envia el scraper externo.
 *
 * Es una forma CANONICA y tolerante: aceptamos lo que necesitamos y permitimos
 * campos extra (passthrough) porque el payload completo igual se guarda crudo.
 * Nunca confiamos en la estructura exacta del proveedor.
 */
import { z } from 'zod';

/** Un comentario tal como llega del scraper. */
export const RawCommentSchema = z
  .object({
    /** Id del comentario en la red (clave de idempotencia). */
    id: z.string().min(1),
    /** Texto del comentario. */
    text: z.string().default(''),
    /** Username del autor (se pseudonimiza o se descarta al procesar). */
    ownerUsername: z.string().optional(),
    likesCount: z.number().int().nonnegative().optional(),
    /** Timestamp ISO del comentario. */
    timestamp: z.string().datetime().optional(),
  })
  .passthrough();

/** Un post con sus comentarios. */
export const RawPostSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().url().optional(),
    ownerUsername: z.string().optional(),
    caption: z.string().optional(),
    /** Foto principal, si el scraper la mandó. */
    imageUrl: z.string().url().optional(),
    timestamp: z.string().datetime().optional(),
    comments: z.array(RawCommentSchema).default([]),
  })
  .passthrough();

/** Payload completo del webhook de ingesta. */
export const IngestionPayloadSchema = z.object({
  /** Identificador del lote/corrida (idempotencia del evento). */
  externalId: z.string().min(1),
  /** Origen del dato. */
  source: z.string().default('apify'),
  /** Red de los posts de este lote. */
  network: z.enum(['instagram', 'twitter']).default('instagram'),
  /** Lista de posts scrapeados. */
  posts: z.array(RawPostSchema).min(1),
});

export type RawComment = z.infer<typeof RawCommentSchema>;
export type RawPost = z.infer<typeof RawPostSchema>;
export type IngestionPayload = z.infer<typeof IngestionPayloadSchema>;
