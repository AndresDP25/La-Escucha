/**
 * Cliente de Prisma compartido (patron singleton).
 *
 * Se instancia una unica vez por proceso para reutilizar el pool de conexiones.
 * En desarrollo se guarda en `globalThis` para evitar multiples instancias ante
 * el hot-reload de tsx.
 */
import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['query', 'warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
