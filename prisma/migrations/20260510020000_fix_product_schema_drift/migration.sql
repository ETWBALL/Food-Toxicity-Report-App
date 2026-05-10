-- Background: the Prisma `Product` model added two fields
-- (`lastExternalResolutionAt`, `externalResolutionSource`) without ever
-- creating the matching DB columns. The reports orchestrator
-- (lib/reports/orchestrate-report.ts) reads/writes these — so the columns
-- must exist for any code that touches `prisma.product` to function.
--
-- Additive only — no DROP, no RENAME. Safe to run on a populated DB.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "last_external_resolution_at" TIMESTAMP(3);

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "external_resolution_source" TEXT;
