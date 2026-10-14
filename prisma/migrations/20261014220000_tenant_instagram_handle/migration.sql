ALTER TABLE "tenants" ADD COLUMN "instagram_handle" TEXT;

UPDATE "tenants" SET "instagram_handle" = 'sanfermunicipio' WHERE "slug" = 'san-fernando';
UPDATE "tenants" SET "instagram_handle" = 'agusciarletta' WHERE "slug" = 'agusciarletta';
