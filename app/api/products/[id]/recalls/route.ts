import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, ok, parseId } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const productId = parseId(params.id);
  if (!productId) return badRequest('invalid product id');

  const u = new URL(req.url);
  const activeOnly = u.searchParams.get('activeOnly') !== 'false';

  const rows = await sql`
    SELECT * FROM recalls
    WHERE (
      product_id = ${productId}
      OR barcode = (SELECT barcode FROM products WHERE id = ${productId})
      OR (SELECT barcode FROM products WHERE id = ${productId}) = ANY(affected_upc_codes)
    )
    AND (${activeOnly}::boolean = FALSE OR active = TRUE)
    ORDER BY recall_date DESC NULLS LAST, id DESC
  `;

  const activeRecalls = rows.filter((r: { active?: boolean }) => r.active).length;

  return ok({ productId, activeRecalls, recalls: rows });
}
