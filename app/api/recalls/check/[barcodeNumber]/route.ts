import { ensureApiTables, sql } from '../../../_lib/db';
import { ok } from '../../../_lib/http';

export async function POST(_: Request, { params }: { params: { barcodeNumber: string } }) {
  await ensureApiTables();
  const recalls = await sql`
    SELECT r.*
    FROM recalls r
    LEFT JOIN products p ON p.id = r.product_id
    WHERE r.active = TRUE
      AND (r.barcode = ${params.barcodeNumber} OR p.barcode = ${params.barcodeNumber})
    ORDER BY r.recall_date DESC NULLS LAST
  `;
  return ok({ barcode: params.barcodeNumber, hasActiveRecall: recalls.length > 0, recalls });
}
