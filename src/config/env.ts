/**
 * Carga y valida las variables de entorno al arrancar la aplicacion.
 *
 * Si falta alguna variable obligatoria o tiene un formato invalido, el proceso
 * falla de inmediato (fail-fast) con un mensaje claro, en lugar de romper mas
 * tarde en runtime.
 */
import 'dotenv/config';
import { z } from 'zod';

/** Esquema de validacion de las variables de entorno. */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // Servidor HTTP
  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().positive().default(3000),

  // Base de datos
  DATABASE_URL: z.string().url(),

  // Autenticacion
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  // Privacidad / anonimizacion
  ANONYMIZATION_PEPPER: z
    .string()
    .min(16, 'ANONYMIZATION_PEPPER debe tener al menos 16 caracteres'),

  // Cola de trabajo (pg-boss)
  QUEUE_SCHEMA: z.string().default('pgboss'),

  // Integracion LLM (opcional)
  LLM_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),

  // Apify: busqueda manual desde el dashboard. Vacio = el boton avisa que falta.
  APIFY_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Variables de entorno invalidas:\n',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

/** Configuracion validada y tipada, lista para usar en toda la app. */
export const env = parsed.data;

/** Atajos utiles. */
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
