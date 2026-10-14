/**
 * Manejador global de errores de Fastify.
 *
 * Traduce los errores de dominio (AppError) y de validacion a respuestas JSON
 * consistentes, y oculta detalles internos en errores inesperados.
 */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { logger } from '../config/logger';

export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Errores de dominio con codigo HTTP explicito.
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({ error: error.message, code: error.code });
    return;
  }

  // Errores de validacion Zod.
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'Datos invalidos',
      code: 'VALIDATION_ERROR',
      details: error.flatten().fieldErrors,
    });
    return;
  }

  // Errores de validacion propios de Fastify (schema de ruta).
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode && fastifyError.statusCode < 500) {
    reply.code(fastifyError.statusCode).send({
      error: fastifyError.message,
      code: fastifyError.code ?? 'BAD_REQUEST',
    });
    return;
  }

  // Error inesperado: log completo, respuesta generica.
  logger.error({ err: error }, 'Error no controlado');
  reply.code(500).send({ error: 'Error interno del servidor', code: 'INTERNAL' });
}
