-- CreateEnum
CREATE TYPE "DiscoveryReason" AS ENUM ('COMMENT_AUTHOR', 'CAPTION_MENTION', 'TAGGED_USER', 'COMMENT_MENTION');

-- CreateEnum
CREATE TYPE "WatchlistStatus" AS ENUM ('PENDING', 'WATCHING', 'IGNORED');

-- CreateTable
CREATE TABLE "watchlist_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "reason" "DiscoveryReason" NOT NULL,
    "status" "WatchlistStatus" NOT NULL DEFAULT 'PENDING',
    "last_post_external_id" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watchlist_accounts_tenant_id_status_idx" ON "watchlist_accounts"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_accounts_tenant_id_username_key" ON "watchlist_accounts"("tenant_id", "username");

-- AddForeignKey
ALTER TABLE "watchlist_accounts" ADD CONSTRAINT "watchlist_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
