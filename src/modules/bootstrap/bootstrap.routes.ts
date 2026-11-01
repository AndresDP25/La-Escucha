import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

function sameSecret(given: string, expected: string): boolean {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function loadSql(sql: Buffer, databaseUrl: string): Promise<void> {
  const file = path.join(tmpdir(), `sld-${randomBytes(8).toString('hex')}.sql`);
  return writeFile(file, sql).then(
    () =>
      new Promise((resolve, reject) => {
        const child = spawn(
          'psql',
          [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', file],
          { stdio: ['ignore', 'ignore', 'pipe'] },
        );
        let error = '';
        child.stderr.on('data', (chunk: Buffer) => {
          error = (error + chunk.toString('utf8')).slice(-4000);
        });
        child.on('close', (code) => {
          unlink(file).catch(() => undefined);
          if (code === 0) resolve();
          else reject(new Error(error || `psql salió con código ${code}`));
        });
      }),
  );
}

export async function bootstrapRoutes(app: FastifyInstance): Promise<void> {
  app.post('/internal/bootstrap', async (request, reply) => {
    const expected = process.env.JWT_SECRET ?? '';
    const given = request.headers['x-bootstrap-token'];
    if (!expected || typeof given !== 'string' || !sameSecret(given, expected)) {
      return reply.code(404).send({ error: 'No encontrado' });
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return reply.code(500).send({ error: 'Falta DATABASE_URL' });
    }
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      return reply.code(400).send({ error: 'Falta el vuelco' });
    }
    await loadSql(request.body, databaseUrl);
    return { ok: true };
  });
}
