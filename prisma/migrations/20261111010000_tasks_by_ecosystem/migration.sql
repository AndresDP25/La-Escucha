-- Las tareas pasan de la cuenta al ecosistema.
ALTER TABLE "tasks" ADD COLUMN "ecosystem_id" TEXT;

UPDATE "tasks" AS t
SET "ecosystem_id" = m."ecosystem_id"
FROM "ecosystem_members" AS m
WHERE m."tenant_id" = t."tenant_id";

WITH ranked AS (
  SELECT
    "id",
    (row_number() OVER (PARTITION BY "ecosystem_id", "status" ORDER BY "position", "created_at") - 1) AS pos
  FROM "tasks"
  WHERE "ecosystem_id" IS NOT NULL
)
UPDATE "tasks" AS t
SET "position" = ranked.pos
FROM ranked
WHERE t."id" = ranked."id";

DELETE FROM "tasks" WHERE "ecosystem_id" IS NULL;

ALTER TABLE "tasks" ALTER COLUMN "ecosystem_id" SET NOT NULL;

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_tenant_id_fkey";

DROP INDEX "tasks_tenant_id_status_position_idx";

ALTER TABLE "tasks" DROP COLUMN "tenant_id";

CREATE INDEX "tasks_ecosystem_id_status_position_idx" ON "tasks"("ecosystem_id", "status", "position");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ecosystem_id_fkey" FOREIGN KEY ("ecosystem_id") REFERENCES "ecosystems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
