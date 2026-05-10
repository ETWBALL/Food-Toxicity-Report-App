import { ensureApiTables, sql } from '../../../_lib/db';
import { notFound, ok } from '../../../_lib/http';
import { fetchProductByBarcode, mapOffToProductRow } from '../../../_lib/openfoodfacts';

export async function GET(_: Request, { params }: { params: { barcodeNumber: string } }) {
  await ensureApiTables();
  const bc = params.barcodeNumber;

  const cached = await sql`SELECT * FROM products WHERE barcode = ${bc} LIMIT 1`;
  if (cached.length) return ok({ ...cached[0], source: 'cache' });

  const off = await fetchProductByBarcode(bc);
  if (!off) return notFound('product not in catalog');

  const row = mapOffToProductRow(bc, off);
  const inserted = await sql`
    INSERT INTO products (barcode, name, brand, type, ingredients, nutritional_info, image_url)
    VALUES (
      ${row.barcode},
      ${row.name},
      ${row.brand},
      ${row.type},
      ${row.ingredients},
      ${row.nutritional_info}::jsonb,
      ${row.image_url}
    )
    ON CONFLICT (barcode)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, products.name),
      brand = COALESCE(EXCLUDED.brand, products.brand),
      type = COALESCE(EXCLUDED.type, products.type),
      ingredients = COALESCE(EXCLUDED.ingredients, products.ingredients),
      nutritional_info = COALESCE(EXCLUDED.nutritional_info, products.nutritional_info),
      image_url = COALESCE(EXCLUDED.image_url, products.image_url),
      updated_at = NOW()
    RETURNING *
  `;
  return ok({ ...inserted[0], source: 'openfoodfacts' });
}
