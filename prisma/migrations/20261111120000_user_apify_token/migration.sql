-- Clave de Apify por usuario. El valor se guarda cifrado.
ALTER TABLE "users" ADD COLUMN "apify_token" TEXT;
