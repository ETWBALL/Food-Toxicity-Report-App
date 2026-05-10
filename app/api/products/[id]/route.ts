import { z } from 'zod';
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

const PutProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    brand: z.string().nullable().optional(),
    ingredients: z.string().nullable().optional(),
    nutritionalInfo: z.record(z.string(), z.unknown()).nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    fda: z.boolean().optional(),
  })
  .strict();

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const id = parseId(params.id);
  if (!id) return badRequest('invalid product id');
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== 'object') return badRequest('invalid body');
  const parsed = PutProductSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    );
  }
  const body = parsed.data;

  const rows = await sql`
    UPDATE products SET
      name = COALESCE(${body.name ?? null}, name),
      brand = COALESCE(${body.brand ?? null}, brand),
      ingredients = COALESCE(${body.ingredients ?? null}, ingredients),
      nutritional_info = COALESCE(${body.nutritionalInfo ? JSON.stringify(body.nutritionalInfo) : null}::jsonb, nutritional_info),
      image_url = COALESCE(${body.imageUrl ?? null}, image_url),
      type = COALESCE(${body.type ?? null}, type),
      fda = COALESCE(${body.fda ?? null}, fda),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) return notFound('product not found');
  return ok(rows[0]);
}
