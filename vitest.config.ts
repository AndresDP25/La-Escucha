import { defineConfig } from 'vitest/config';

/**
 * Config de Vitest. Define variables de entorno minimas para los tests
 * unitarios, de modo que la validacion de `src/config/env.ts` no falle al
 * importar modulos que dependen de la configuracion.
 */
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
      JWT_SECRET: 'test-secret-para-tests-unitarios',
      ANONYMIZATION_PEPPER: 'test-pepper-para-tests-unitarios',
    },
  },
});
