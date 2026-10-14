-- Casos marcados a mano desde el briefing. No toca posts ni comentarios.
CREATE TYPE "CaseStatus" AS ENUM ('NEW', 'FOLLOWING', 'HANDED_OFF');

CREATE TABLE "listening_cases" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "Category",
    "place" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "comment_id" TEXT,
    "excerpt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listening_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "listening_cases_tenant_id_status_idx" ON "listening_cases"("tenant_id", "status");

CREATE UNIQUE INDEX "listening_cases_tenant_id_comment_id_key" ON "listening_cases"("tenant_id", "comment_id");

ALTER TABLE "listening_cases" ADD CONSTRAINT "listening_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
