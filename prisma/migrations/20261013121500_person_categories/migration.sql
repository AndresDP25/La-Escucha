-- Categorias para cuentas-persona (Ciarletta), sin tocar las municipales.
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'ENGAGEMENT';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'ATTACK';
