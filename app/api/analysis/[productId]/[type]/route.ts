import { requireAuth } from '@/lib/auth/proxy';
import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/** Legacy SQL-backed cache; requires login so cached rows are not world-readable. */
export async function GET(req: Request, { params }: { params: { productId: string; type: string } }) {
  return requireAuth(req, async () => {
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
  });
}
