import { ensureApiTables, sql } from '../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../_lib/http';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const id = parseId(params.id);
  if (!id) return badRequest('invalid product id');
  const rows = await sql`SELECT * FROM products WHERE id = ${id}`;
  if (!rows.length) return notFound('product not found');
  return ok(rows[0]);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const id = parseId(params.id);
  if (!id) return badRequest('invalid product id');
  const body = await req.json().catch(() => null);
  if (!body) return badRequest('invalid body');
  const rows = await sql`
    UPDATE products SET
      name = COALESCE(${body.name || null}, name),
      brand = COALESCE(${body.brand || null}, brand),
      ingredients = COALESCE(${body.ingredients || null}, ingredients),
      nutritional_info = COALESCE(${body.nutritionalInfo ? JSON.stringify(body.nutritionalInfo) : null}::jsonb, nutritional_info),
      image_url = COALESCE(${body.imageUrl || null}, image_url),
      type = COALESCE(${body.type || null}, type),
      fda = COALESCE(${body.fda ?? null}, fda),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) return notFound('product not found');
  return ok(rows[0]);
}
