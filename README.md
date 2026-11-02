# Social Listening Dashboard

Sistema **multimunicipio** de *social listening* para monitorear redes sociales
(Instagram, vía un scraper externo tipo **Apify**) e identificar reclamos
vecinales, problemáticas de gestión (seguridad, salud, obras) y el clima de
opinión pública.

> No programamos el scraper. Consumimos un servicio externo que extrae datos de
> Instagram y nos los entrega en JSON. Nuestro foco es la **ingesta,
> almacenamiento, procesamiento inteligente (NLP) y exposición** de esos datos.

## Stack

- **TypeScript** + **Node.js 20+**
- **Fastify** (API HTTP) + **helmet** + **rate-limit**
- **PostgreSQL** + **Prisma ORM** (campos `JSONB` para el crudo flexible)
- **pg-boss** como cola de trabajo (sobre la misma base, sin Redis)
- **Zod** (validación), **pino** (logs), **JWT** + **bcrypt** (auth)
- **Vitest** (tests), **Docker Compose** (entorno)

## Arquitectura (por capas / modular)

```
src/
├── config/      Env validado (Zod), logger
├── db/          Cliente Prisma
├── core/        Lógica reutilizable de dominio
│   ├── queue/        Wrapper de pg-boss
│   ├── text/         Normalización, stop-words, emojis
│   ├── privacy/      Anonimización / pseudonimización / scrubbing PII
│   └── classifier/   Interfaz Classifier + KeywordClassifier (+ LLM futuro)
├── middlewares/ Auth (JWT + roles), tenant-scope, manejo de errores
├── modules/     Features (routes + service por módulo)
│   ├── auth/         Login
│   ├── ingestion/    Webhook firmado (HMAC) + persistencia cruda
│   ├── processing/   Pipeline NLP (corre en el worker)
│   ├── keywords/     Diccionario dinámico por municipio
│   ├── tenants/      Administración de municipios (SUPER_ADMIN)
│   └── analytics/    Agregados para el dashboard
├── shared/      Errores de dominio
├── app.ts       Construcción de Fastify
├── server.ts    Arranque de la API
└── worker.ts    Proceso que consume la cola y procesa
```

### Flujo de datos

```
Apify (webhook POST firmado)
  → [API] valida HMAC + Zod → guarda crudo (IngestionEvent) → responde 202
  → encola en pg-boss
  → [Worker] normaliza texto → clasifica (keywords del tenant) → sentimiento
            → aplica privacidad → persiste Post/Comment
  → [API] /analytics expone agregados al dashboard
```

## Multitenancy (multimunicipio)

Todo registro cuelga de un **Tenant** (municipio) vía `tenantId`. Cada municipio
tiene sus propios **ScrapeTargets** (qué scrapear), sus **KeywordConfigs** (cómo
clasificar) y sus datos **aislados**. Sumar un municipio = crear un `Tenant` +
cargar sus targets y keywords, **sin tocar código**.

### Roles

| Rol | Alcance |
|-----|---------|
| `SUPER_ADMIN` | Todos los municipios (indica el tenant vía header `x-tenant-id`) |
| `ADMIN` | Administra la config de su municipio (keywords, etc.) |
| `OPERATOR` | Opera: dispara/revisa scrapings |
| `VIEWER` | Solo lectura del dashboard |

## Privacidad (Ley 25.326, Argentina)

Las opiniones políticas son **datos sensibles**. Aplicamos dos niveles:

- **Pseudonimización** (comentarios comunes): el usuario se reemplaza por un
  hash HMAC estable (salt del tenant + pepper global).
- **Anonimización irreversible** (comentarios sensibles/políticos): se descarta
  el usuario y el texto original, y se corre *scrubbing* de PII (emails,
  teléfonos, DNI, menciones).

## Puesta en marcha (desarrollo)

```bash
# 1. Variables de entorno
cp .env.example .env   # completar JWT_SECRET y ANONYMIZATION_PEPPER

# 2. Dependencias
npm install

# 3. Base de datos (Docker) + migraciones + seed
# En esta maquina Compose v1: docker-compose. Postgres queda en localhost:5436
docker-compose up -d db
npm run prisma:migrate
npm run db:seed

# pgAdmin de escritorio: host 127.0.0.1, puerto 5436, user/pass/db sld / sld / social_listening

# 4. Arrancar API, worker y dashboard (tres terminales)
npm run dev
npm run dev:worker
npm run dev:web
```

Dashboard: [http://localhost:5173](http://localhost:5173)  
Los usuarios se crean en Ajustes → Usuarios.

### Mapear un export de Apify (sin gastar credito)

El actor `apify/instagram-scraper` entrega un **array de posts** con `latestComments`
(no `comments`). El mapper lo traduce al payload de ingesta y lista cuentas
descubiertas (autores de comentarios, menciones, tags):

```bash
npm run map:apify -- "../info - social - listening/dataset_instagram-scraper_2026-10-12_22-17-24-247.json"
```

Genera un `*-mapped.json` al lado del original. Ese archivo (o el dataset crudo)
se puede POST-ear al webhook: si el body es un array de Apify, la API lo mapea sola.

### Probar el webhook de ingesta

El cuerpo debe ir firmado con el `webhookSecret` del tenant (lo imprime el seed):

```bash
BODY='{"externalId":"run-1","posts":[{"id":"p1","comments":[{"id":"c1","text":"Hay un bache enorme en Av. Avellaneda"}]}]}'
SIG=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "<WEBHOOK_SECRET>" | awk '{print $2}')

curl -X POST http://localhost:3000/webhooks/ingest/san-fernando \
  -H "Content-Type: application/json" \
  -H "x-signature: sha256=$SIG" \
  -d "$BODY"
```

## Roadmap

- **Fase 0** – Ingesta end-to-end (crudo). ✅
- **Fase 1** – Procesamiento mock (keywords + sentimiento + anonimización). ✅
- **Fase 2** – Analytics / API para dashboard. ✅
- **Fase 3** – `LLMClassifier` real (OpenAI/Claude) detrás de la misma interfaz.
- **Fase 4** – Panel de administración (ABM de municipios y keywords por UI).

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | API en modo watch |
| `npm run dev:worker` | Worker en modo watch |
| `npm run build` | Compila a `dist/` |
| `npm run prisma:migrate` | Crea/aplica migraciones (dev) |
| `npm run db:seed` | Carga datos iniciales |
| `npm test` | Tests (Vitest) |
| `npm run map:apify -- <json>` | Traduce un export de Apify al payload interno |
| `npm run ingest:local -- <json>` | POST firmado al webhook local |
