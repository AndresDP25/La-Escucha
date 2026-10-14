/**
 * Logger estructurado (pino) compartido por la API y el worker.
 *
 * En desarrollo usa salida legible (pino-pretty); en produccion emite JSON
 * para que sea facilmente ingerible por herramientas de observabilidad.
 */
import pino from 'pino';
import { env, isProduction } from './env';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  // En desarrollo embellecemos la salida; en produccion dejamos JSON crudo.
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
  base: { env: env.NODE_ENV },
});
