/**
 * Errores de dominio con codigo HTTP asociado.
 *
 * El manejador global de errores de Fastify los traduce a respuestas JSON
 * consistentes (ver src/middlewares/error-handler.ts).
 */

/** Error base de la aplicacion. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 400 - Datos de entrada invalidos. */
export class ValidationError extends AppError {
  constructor(message = 'Datos invalidos') {
    super(400, message, 'VALIDATION_ERROR');
  }
}

/** 401 - No autenticado. */
export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(401, message, 'UNAUTHORIZED');
  }
}

/** 403 - Autenticado pero sin permisos suficientes. */
export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(403, message, 'FORBIDDEN');
  }
}

/** 404 - Recurso inexistente. */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, message, 'NOT_FOUND');
  }
}

/** 409 - Conflicto de unicidad (slug, email, etc.). */
export class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe') {
    super(409, message, 'CONFLICT');
  }
}
