import { z } from 'zod';
import { ensureApiTables, sql } from '../_lib/db';
import { badRequest, ok } from '../_lib/http';

export const dynamic = 'force-dynamic';

const PostProductSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  ingredients: z.string().nullable().optional(),
  nutritionalInfo: z.record(z.string(), z.unknown()).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  fda: z.boolean().optional(),
});

export async function POST(req: Request) {
  await ensureApiTables();
  const raw = await req.json().catch(() => null);
  const parsed = PostProductSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    );
  }
  const body = parsed.data;

  const result = await sql`
    INSERT INTO products (barcode, name, brand, ingredients, nutritional_info, image_url, type, fda)
    VALUES (
      ${body.barcode},
      ${body.name},
      ${body.brand ?? null},
      ${body.ingredients ?? null},
      ${body.nutritionalInfo ? JSON.stringify(body.nutritionalInfo) : null}::jsonb,
      ${body.imageUrl ?? null},
      ${body.type ?? null},
      ${Boolean(body.fda)}
    )
    ON CONFLICT (barcode)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, products.name),
      brand = COALESCE(EXCLUDED.brand, products.brand),
      ingredients = COALESCE(EXCLUDED.ingredients, products.ingredients),
      nutritional_info = COALESCE(EXCLUDED.nutritional_info, products.nutritional_info),
      image_url = COALESCE(EXCLUDED.image_url, products.image_url),
      type = COALESCE(EXCLUDED.type, products.type),
      fda = EXCLUDED.fda,
      updated_at = NOW()
    RETURNING *
  `;
  return ok(result[0], 201);
}
