/**
 * GET /api/analysis/:productId/:type
 *
 * Legacy endpoint: reads one row from SQL table `ai_analysis_cache` (created by `ensureApiTables`). Requires session — not a public cache.
 *
 * Params: numeric `productId`, `type` string matching `analysis_type` in the cache.
 *
 * Success `200`: cached row; `400` bad id; `404` no cache row.
 */
import { requireAuth } from '@/lib/auth/proxy';
import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

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
