/**
 * Reprocesa eventos de ingesta ya guardados (nuevo diccionario).
 *
 *   npm run reclassify -- agusciarletta
 */
import { prisma } from '../src/db/prisma';
import { processIngestionEvent } from '../src/modules/processing/processing.service';

const slug = process.argv[2] ?? 'agusciarletta';

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error(`Tenant '${slug}' no encontrado`);

  const events = await prisma.ingestionEvent.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  await prisma.ingestionEvent.updateMany({
    where: { tenantId: tenant.id },
    data: { status: 'RECEIVED', error: null, processedAt: null },
  });

  for (const event of events) {
    await processIngestionEvent(event.id);
  }

  // eslint-disable-next-line no-console
  console.log(`Reclasificados ${events.length} lote(s) de ${tenant.name}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
