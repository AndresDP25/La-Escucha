/**
 * Pizarra de tareas de una cuenta. Cada municipio ve solo las suyas.
 * Cualquier usuario autenticado del tenant puede crearlas y moverlas.
 */
import type { FastifyInstance } from 'fastify';
import type { TaskStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authenticate, resolveTenantId } from '../../middlewares/auth';
import { NotFoundError } from '../../shared/errors';

const StatusEnum = z.enum(['TODO', 'DOING', 'DONE']);

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  status: StatusEnum.default('TODO'),
});

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: StatusEnum.optional(),
  beforeId: z.string().uuid().nullable().optional(),
});

async function placeTask(
  tenantId: string,
  id: string,
  status: TaskStatus,
  beforeId: string | null,
): Promise<void> {
  const column = await prisma.task.findMany({
    where: { tenantId, OR: [{ status }, { id }] },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const current = column.find((task) => task.id === id);
  if (!current) throw new NotFoundError('Tarea no encontrada');

  const rest = column.filter((task) => task.id !== id && task.status === status);
  let index = rest.length;
  if (beforeId) {
    const at = rest.findIndex((task) => task.id === beforeId);
    if (at >= 0) index = at;
  }
  rest.splice(index, 0, current);

  await prisma.$transaction(
    rest.map((task, position) =>
      prisma.task.update({
        where: { id: task.id },
        data: { status, position },
      }),
    ),
  );
}

export async function tasksRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/tasks', async (request) => {
    const tenantId = resolveTenantId(request);
    return prisma.task.findMany({
      where: { tenantId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        position: true,
        createdAt: true,
      },
    });
  });

  app.post('/tasks', async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const data = CreateSchema.parse(request.body);
    const last = await prisma.task.aggregate({
      where: { tenantId, status: data.status },
      _max: { position: true },
    });
    const created = await prisma.task.create({
      data: {
        tenantId,
        title: data.title,
        status: data.status,
        position: (last._max.position ?? -1) + 1,
      },
      select: {
        id: true,
        title: true,
        status: true,
        position: true,
        createdAt: true,
      },
    });
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>('/tasks/:id', async (request) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params;
    const data = PatchSchema.parse(request.body);
    const existing = await prisma.task.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError('Tarea no encontrada');

    if (data.status) {
      await placeTask(tenantId, id, data.status, data.beforeId ?? null);
    }
    if (data.title) {
      await prisma.task.update({ where: { id }, data: { title: data.title } });
    }

    const updated = await prisma.task.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        title: true,
        status: true,
        position: true,
        createdAt: true,
      },
    });
    if (!updated) throw new NotFoundError('Tarea no encontrada');
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params;
    const existing = await prisma.task.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Tarea no encontrada');
    await prisma.task.delete({ where: { id } });
    return reply.code(204).send();
  });
}
