import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../../_lib/http';

export async function GET(_: Request, { params }: { params: { productId: string; type: string } }) {
  await ensureApiTables();
  const productId = parseId(params.productId);
  if (!productId) return badRequest('invalid product id');
  const rows = await sql`
    SELECT * FROM ai_analysis_cache
    WHERE product_id = ${productId}
      AND analysis_type = ${params.type}
    LIMIT 1
  `;
  if (!rows.length) return notFound('analysis not found');
  return ok(rows[0]);
}
