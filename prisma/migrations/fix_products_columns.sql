-- Add missing columns to products to match Prisma schema
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "servingSize" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "countryOfOrigin" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lastExternalResolutionAt" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "externalResolutionSource" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
