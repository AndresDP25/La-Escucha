ALTER TABLE "watchlist_accounts" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'instagram';

DROP INDEX "watchlist_accounts_tenant_id_username_key";

CREATE UNIQUE INDEX "watchlist_accounts_tenant_id_network_username_key" ON "watchlist_accounts"("tenant_id", "network", "username");
