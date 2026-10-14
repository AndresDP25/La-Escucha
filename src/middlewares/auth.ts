/**
 * Autenticacion y autorizacion basadas en JWT + roles.
 *
 * - `authenticate`: preHandler que valida el token Bearer y adjunta el usuario
 *   actual al request (`request.currentUser`).
 * - `authorize(...roles)`: preHandler que exige uno de los roles dados.
 * - `resolveTenantId`: determina sobre que tenant opera el request. Los usuarios
 *   normales operan sobre SU tenant; el SUPER_ADMIN puede especificar otro via
 *   header `x-tenant-id`.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { ForbiddenError, UnauthorizedError } from '../shared/errors';

/** Datos del usuario autenticado que viajan en el token. */
export interface CurrentUser {
  userId: string;
  tenantId: string | null;
  role: Role;
  email: string;
}

// Augmentar el tipo de FastifyRequest para incluir el usuario actual.
declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}

/** Genera un token JWT para un usuario. */
export function signToken(user: CurrentUser): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(user, env.JWT_SECRET, options);
}

/** preHandler: valida el token y adjunta `currentUser`. */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Falta el token de autenticacion');
  }

  const token = header.slice('Bearer '.length);
  try {
    request.currentUser = jwt.verify(token, env.JWT_SECRET) as CurrentUser;
  } catch {
    throw new UnauthorizedError('Token invalido o expirado');
  }
}

/** Factory de preHandler que exige uno de los roles indicados. */
export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = request.currentUser;
    if (!user) throw new UnauthorizedError();
    if (!roles.includes(user.role)) {
      throw new ForbiddenError('No tenes permisos para esta operacion');
    }
  };
}

/**
 * Resuelve el tenant sobre el que opera el request.
 * - SUPER_ADMIN: usa el header `x-tenant-id` (puede operar sobre cualquiera).
 * - Resto: siempre su propio tenant.
 */
export function resolveTenantId(request: FastifyRequest): string {
  const user = request.currentUser;
  if (!user) throw new UnauthorizedError();

  if (user.role === 'SUPER_ADMIN') {
    const headerTenant = request.headers['x-tenant-id'] as string | undefined;
    if (!headerTenant) {
      throw new ForbiddenError(
        'SUPER_ADMIN debe indicar el tenant via header x-tenant-id',
      );
    }
    return headerTenant;
  }

  if (!user.tenantId) {
    throw new ForbiddenError('El usuario no esta asociado a ningun municipio');
  }
  return user.tenantId;
}
