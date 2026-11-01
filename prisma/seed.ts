/**
 * Seed inicial de la base de datos.
 *
 * Crea:
 *  - Un usuario SUPER_ADMIN global (cambia de tenant con x-tenant-id).
 *  - Tenant Agustina Ciarletta y tenant Municipio de San Fernando.
 *  - ADMIN de cada tenant y VIEWER de San Fernando.
 *  - Objetivos de scraping (cuentas / hashtags) de ejemplo.
 *  - Un diccionario de keywords de ejemplo por categoria.
 *
 * Idempotente: usa upsert por claves naturales. Las contrasenas de ejemplo son
 * SOLO para desarrollo; cambiarlas en produccion.
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
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
  const passwordHash = await bcrypt.hash('cambiar123', 10);

  // --- SUPER_ADMIN global (sin tenant) ---
  await prisma.user.upsert({
    where: { email: 'superadmin@sld.local' },
    update: {},
    create: {
      email: 'superadmin@sld.local',
      fullName: 'Super Administrador',
      role: 'SUPER_ADMIN',
      passwordHash,
      tenantId: null,
    },
  });

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

  await prisma.user.upsert({
    where: { email: 'admin@agusciarletta.local' },
    update: { tenantId: agus.id, fullName: 'Admin Agustina Ciarletta' },
    create: {
      email: 'admin@agusciarletta.local',
      fullName: 'Admin Agustina Ciarletta',
      role: 'ADMIN',
      passwordHash,
      tenantId: agus.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@san-fernando.local' },
    update: { tenantId: sanFernando.id, fullName: 'Admin San Fernando' },
    create: {
      email: 'admin@san-fernando.local',
      fullName: 'Admin San Fernando',
      role: 'ADMIN',
      passwordHash,
      tenantId: sanFernando.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@san-fernando.local' },
    update: { tenantId: sanFernando.id, fullName: 'Viewer San Fernando' },
    create: {
      email: 'viewer@san-fernando.local',
      fullName: 'Viewer San Fernando',
      role: 'VIEWER',
      passwordHash,
      tenantId: sanFernando.id,
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
  // eslint-disable-next-line no-console
  console.log('   Usuarios (password: cambiar123):');
  // eslint-disable-next-line no-console
  console.log('     superadmin@sld.local (cambia de tenant con el select)');
  // eslint-disable-next-line no-console
  console.log('     admin@agusciarletta.local / admin@san-fernando.local / viewer@san-fernando.local');
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
