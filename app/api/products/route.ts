/**
 * POST /api/products
 *
 * Upserts a catalog product by `barcodeNumber` (idempotent create/update).
 *
 * Auth: if `INTERNAL_API_KEY` is set, send `Authorization: Bearer <INTERNAL_API_KEY>`; otherwise a logged-in session is required (`gateCatalogWrite`).
 *
 * Body: `{ barcodeNumber, name, brand?, description?, ... }` — see `PostProductSchema`. `nutritionalInfo` may be string or object (serialized to JSON string).
 *
 * Success `201`: created/updated `product` row (wrapped via `ok`).
 *
 * Errors: `401` unauthorized, `400` validation.
 */
import { z } from 'zod';
import { gateCatalogWrite } from '@/lib/auth/gate-catalog-write';
import { prisma } from '@/lib/prisma';
import { ok, validationError } from '../_lib/http';

export const dynamic = 'force-dynamic';

const PostProductSchema = z.object({
  barcodeNumber: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
  servingSize: z.string().nullable().optional(),
  ingredientList: z.string().nullable().optional(),
  nutritionalInfo: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const denied = await gateCatalogWrite(req);
  if (denied) return denied;

  const raw = await req.json().catch(() => null);
  const parsed = PostProductSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error.issues);
  const body = parsed.data;

  const nutritionalInfo =
    body.nutritionalInfo === undefined || body.nutritionalInfo === null
      ? null
      : typeof body.nutritionalInfo === 'string'
        ? body.nutritionalInfo
        : JSON.stringify(body.nutritionalInfo);

  // Upsert by barcodeNumber for idempotency. Spec says 409 on duplicate;
  // we deliberately upsert to keep seed/sync paths idempotent.
  const product = await prisma.product.upsert({
    where: { barcodeNumber: body.barcodeNumber },
    update: {
      name: body.name,
      brand: body.brand ?? undefined,
      description: body.description ?? undefined,
      manufacturer: body.manufacturer ?? undefined,
      countryOfOrigin: body.countryOfOrigin ?? undefined,
      servingSize: body.servingSize ?? undefined,
      ingredientList: body.ingredientList ?? undefined,
      nutritionalInfo: nutritionalInfo ?? undefined,
      imageUrl: body.imageUrl ?? undefined,
      type: body.type ?? undefined,
    },
    create: {
      barcodeNumber: body.barcodeNumber,
      name: body.name,
      brand: body.brand ?? null,
      description: body.description ?? null,
      manufacturer: body.manufacturer ?? null,
      countryOfOrigin: body.countryOfOrigin ?? null,
      servingSize: body.servingSize ?? null,
      ingredientList: body.ingredientList ?? null,
      nutritionalInfo: nutritionalInfo ?? undefined,
      imageUrl: body.imageUrl ?? null,
      type: body.type ?? null,
    },
  });
  return ok(product, 201);
}
