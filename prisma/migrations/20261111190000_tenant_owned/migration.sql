-- Una cuenta propia es aquella desde la que podemos publicar.
ALTER TABLE "tenants" ADD COLUMN "is_owned" BOOLEAN NOT NULL DEFAULT false;
