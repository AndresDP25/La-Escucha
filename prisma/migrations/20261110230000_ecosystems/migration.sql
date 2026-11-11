-- CreateTable
CREATE TABLE "ecosystems" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecosystems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecosystem_members" (
    "ecosystem_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "ecosystem_members_pkey" PRIMARY KEY ("ecosystem_id","tenant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ecosystems_slug_key" ON "ecosystems"("slug");

-- CreateIndex
CREATE INDEX "ecosystem_members_tenant_id_idx" ON "ecosystem_members"("tenant_id");

-- AddForeignKey
ALTER TABLE "ecosystem_members" ADD CONSTRAINT "ecosystem_members_ecosystem_id_fkey" FOREIGN KEY ("ecosystem_id") REFERENCES "ecosystems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecosystem_members" ADD CONSTRAINT "ecosystem_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
