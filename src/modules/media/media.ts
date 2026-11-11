/**
 * Copia local de la foto de una publicación.
 * El enlace de Instagram vence a los pocos días; si lo bajamos al guardar,
 * el dashboard sigue mostrando la imagen.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const DIR = path.join(process.cwd(), 'data', 'media');

function fileOf(postId: string): string {
  return path.join(DIR, postId);
}

function typeOf(postId: string): string {
  return path.join(DIR, `${postId}.type`);
}

export async function hasPostImage(postId: string): Promise<boolean> {
  return access(fileOf(postId)).then(
    () => true,
    () => false,
  );
}

export function localImageUrl(postId: string): string {
  return `/api/media/posts/${postId}`;
}

export async function savePostImage(postId: string, url: string): Promise<boolean> {
  if (!/^https:\/\//i.test(url)) return false;
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      referer: 'https://www.instagram.com/',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return false;
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!type.startsWith('image/')) return false;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 200) return false;
  await mkdir(DIR, { recursive: true });
  await writeFile(fileOf(postId), bytes);
  await writeFile(typeOf(postId), type);
  return true;
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/media/posts/:id', async (request, reply) => {
    const { id } = request.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(404).send();
    try {
      const [bytes, type] = await Promise.all([
        readFile(fileOf(id)),
        readFile(typeOf(id), 'utf8'),
      ]);
      return reply
        .header('content-type', type.trim() || 'image/jpeg')
        .header('cache-control', 'public, max-age=86400')
        .send(bytes);
    } catch {
      return reply.code(404).send();
    }
  });
}
