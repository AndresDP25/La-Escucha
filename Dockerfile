# ============================================================================
# Imagen multi-stage: compila TypeScript y corre el build en una imagen liviana.
# La misma imagen sirve para la API (dist/server.js) y el worker (dist/worker.js);
# el comando se define en docker-compose.yml.
# ============================================================================

# --- Etapa de build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias (incluye devDependencies para compilar)
COPY package*.json ./
RUN npm install

# Copiar el codigo y generar el cliente de Prisma + compilar TS
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Etapa de runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Solo dependencias de produccion
COPY package*.json ./
RUN npm install --omit=dev

# Artefactos compilados y cliente de Prisma generado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/server.js"]
