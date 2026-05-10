import { ensureApiTables, sql } from '../../../_lib/db';
import { ok } from '../../../_lib/http';
import { worstSeverity } from '../../../_lib/score';

export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: { barcodeNumber: string } }) {
  await ensureApiTables();
  const bc = params.barcodeNumber;
  const recalls = await sql`
    SELECT r.*
    FROM recalls r
    LEFT JOIN products p ON p.id = r.product_id
    WHERE r.active = TRUE
      AND (
        r.barcode = ${bc}
        OR p.barcode = ${bc}
        OR ${bc} = ANY(r.affected_upc_codes)
      )
    ORDER BY r.recall_date DESC NULLS LAST
  `;
  const severities = recalls.map((r: { severity_level?: string | null }) => r.severity_level);
  return ok({
    barcodeNumber: bc,
    hasRecall: recalls.length > 0,
    worstSeverity: worstSeverity(severities),
    activeRecallCount: recalls.length,
    recalls,
  });
}
