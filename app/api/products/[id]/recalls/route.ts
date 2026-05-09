import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, ok, parseId } from '../../../_lib/http';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const productId = parseId(params.id);
  if (!productId) return badRequest('invalid product id');
  const rows = await sql`
    SELECT * FROM recalls
    WHERE product_id = ${productId}
    ORDER BY recall_date DESC NULLS LAST, id DESC
  `;
  return ok(rows);
}
