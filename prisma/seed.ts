/**
 * Seed inicial de la base de datos.
 *
 * Crea:
 *  - Tenant Agustina Ciarletta y tenant Municipio de San Fernando.
 *  - Objetivos de scraping (cuentas / hashtags) de ejemplo.
 *  - Un diccionario de keywords de ejemplo por categoria.
 *
 * Los usuarios se dan de alta desde Ajustes. Idempotente: usa upsert por claves naturales.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PARTY_KEYWORDS } from '../src/core/classifier/party-keywords';

const prisma = new PrismaClient();

/** Keywords de ejemplo para San Fernando (categoria -> patrones literales). */
type KeywordGroup = {
  category: 'SECURITY' | 'PUBLIC_WORKS' | 'HEALTH' | 'POLITICS' | 'SUPPORT' | 'ENGAGEMENT' | 'ATTACK';
  patterns: string[];
  weight?: number;
};

const SAN_FERNANDO_KEYWORDS: KeywordGroup[] = [
  { category: 'PUBLIC_WORKS', patterns: ['bache', 'calle', 'vereda', 'obra', 'alumbrado', 'cloaca', 'av avellaneda'] },
  { category: 'SECURITY', patterns: ['robo', 'robaron', 'inseguridad', 'patrulla', 'moto', 'arrebato'] },
  { category: 'HEALTH', patterns: ['hospital', 'salita', 'turno', 'ambulancia', 'vacuna'] },
  { category: 'POLITICS', patterns: ['intendente', 'concejal', 'campania', 'militancia', 'puntero'] },
];

const CIARLETTA_KEYWORDS: KeywordGroup[] = [
  {
    category: 'SUPPORT',
    patterns: ['excelente', 'fundamental', 'genialidad', 'ojala', 'fuerza', 'te voto', 'vamos'],
  },
  {
    category: 'ENGAGEMENT',
    weight: 2,
    patterns: ['participar', 'reuniones', 'reunion', 'registrar', 'registrarme'],
  },
  {
    category: 'ATTACK',
    weight: 2,
    patterns: ['media pila', 'charletta', 'jajaja', 'rompen'],
  },
  {
    category: 'POLITICS',
    patterns: ['politica', 'nacion', 'municipio'],
  },
];

const PILOT_TARGETS: { type: 'ACCOUNT' | 'HASHTAG' | 'LOCATION'; value: string }[] = [
  { type: 'ACCOUNT', value: '@agusciarletta' },
];

async function main(): Promise<void> {
  const agus = await prisma.tenant.upsert({
    where: { slug: 'agusciarletta' },
    update: { name: 'Agustina Ciarletta', instagramHandle: 'agusciarletta' },
    create: {
      name: 'Agustina Ciarletta',
      slug: 'agusciarletta',
      instagramHandle: 'agusciarletta',
      webhookSecret: randomBytes(32).toString('hex'),
      anonymizationSalt: randomBytes(16).toString('hex'),
    },
  });

  const sanFernando = await prisma.tenant.upsert({
    where: { slug: 'san-fernando' },
    update: { name: 'Municipio de San Fernando', instagramHandle: 'sanfermunicipio' },
    create: {
      name: 'Municipio de San Fernando',
      slug: 'san-fernando',
      instagramHandle: 'sanfermunicipio',
      webhookSecret: randomBytes(32).toString('hex'),
      anonymizationSalt: randomBytes(16).toString('hex'),
    },
  });

  await prisma.scrapeTarget.upsert({
    where: {
      tenantId_type_value: {
        tenantId: sanFernando.id,
        type: 'ACCOUNT',
        value: '@sanfermunicipio',
      },
    },
    update: { isActive: true },
    create: {
      tenantId: sanFernando.id,
      type: 'ACCOUNT',
      value: '@sanfermunicipio',
      isActive: true,
    },
  });

  for (const target of PILOT_TARGETS) {
    await prisma.scrapeTarget.upsert({
      where: {
        tenantId_type_value: {
          tenantId: agus.id,
          type: target.type,
          value: target.value,
        },
      },
      update: {},
      create: { tenantId: agus.id, ...target },
    });
  }

  await prisma.keywordConfig.deleteMany({
    where: {
      tenantId: agus.id,
      category: { in: ['SECURITY', 'PUBLIC_WORKS', 'HEALTH'] },
    },
  });

  async function seedKeywords(tenantId: string, groups: KeywordGroup[]) {
    for (const group of groups) {
      for (const pattern of group.patterns) {
        const exists = await prisma.keywordConfig.findFirst({
          where: { tenantId, category: group.category, pattern },
          select: { id: true },
        });
        if (!exists) {
          await prisma.keywordConfig.create({
            data: {
              tenantId,
              category: group.category,
              pattern,
              matchType: 'LITERAL',
              weight: group.weight ?? 1,
            },
          });
        }
      }
    }
  }

  await seedKeywords(sanFernando.id, SAN_FERNANDO_KEYWORDS);
  await seedKeywords(agus.id, CIARLETTA_KEYWORDS);

  for (const slug of ['pro-argentina', 'pro-ciudad']) {
    const party = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (party) await seedKeywords(party.id, PARTY_KEYWORDS);
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed completado.');
  // eslint-disable-next-line no-console
  console.log(`   Tenants: ${agus.name} (${agus.slug}) | ${sanFernando.name} (${sanFernando.slug})`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('❌ Error en el seed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
