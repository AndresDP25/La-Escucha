-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('ACCOUNT', 'HASHTAG', 'LOCATION');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SECURITY', 'PUBLIC_WORKS', 'HEALTH', 'POLITICS', 'OTHER');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('LITERAL', 'REGEX');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'ERROR');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "webhook_secret" TEXT NOT NULL,
    "anonymization_salt" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "TargetType" NOT NULL,
    "value" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "pattern" TEXT NOT NULL,
    "match_type" "MatchType" NOT NULL DEFAULT 'LITERAL',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'apify',
    "external_id" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "ingestion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'instagram',
    "external_id" TEXT NOT NULL,
    "url" TEXT,
    "author_ref" TEXT,
    "caption" TEXT,
    "published_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "author_hash" TEXT,
    "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "raw_text" TEXT,
    "clean_text" TEXT NOT NULL,
    "emojis" TEXT[],
    "category" "Category" NOT NULL DEFAULT 'OTHER',
    "sentiment" "Sentiment" NOT NULL DEFAULT 'NEUTRAL',
    "like_count" INTEGER,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "scrape_targets_tenant_id_idx" ON "scrape_targets"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "scrape_targets_tenant_id_type_value_key" ON "scrape_targets"("tenant_id", "type", "value");

-- CreateIndex
CREATE INDEX "keyword_configs_tenant_id_category_idx" ON "keyword_configs"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "keyword_configs_tenant_id_is_active_idx" ON "keyword_configs"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "ingestion_events_tenant_id_status_idx" ON "ingestion_events"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_events_tenant_id_source_external_id_key" ON "ingestion_events"("tenant_id", "source", "external_id");

-- CreateIndex
CREATE INDEX "posts_tenant_id_published_at_idx" ON "posts"("tenant_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "posts_tenant_id_network_external_id_key" ON "posts"("tenant_id", "network", "external_id");

-- CreateIndex
CREATE INDEX "comments_tenant_id_category_sentiment_idx" ON "comments"("tenant_id", "category", "sentiment");

-- CreateIndex
CREATE INDEX "comments_tenant_id_published_at_idx" ON "comments"("tenant_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "comments_tenant_id_external_id_key" ON "comments"("tenant_id", "external_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_targets" ADD CONSTRAINT "scrape_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_configs" ADD CONSTRAINT "keyword_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_events" ADD CONSTRAINT "ingestion_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
