import { ensureApiTables, sql } from '../_lib/db';
import { badRequest, ok } from '../_lib/http';

export async function POST(req: Request) {
  await ensureApiTables();
  const body = await req.json().catch(() => null);
  if (!body?.barcode) return badRequest('barcode required');
  const result = await sql`
    INSERT INTO products (barcode, name, brand, ingredients, nutritional_info, image_url, type, fda)
    VALUES (
      ${body.barcode},
      ${body.name || null},
      ${body.brand || null},
      ${body.ingredients || null},
      ${body.nutritionalInfo ? JSON.stringify(body.nutritionalInfo) : null}::jsonb,
      ${body.imageUrl || null},
      ${body.type || null},
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
