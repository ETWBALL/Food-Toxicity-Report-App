import { ensureApiTables, sql } from '../../../_lib/db';
import { notFound, ok } from '../../../_lib/http';

export async function GET(_: Request, { params }: { params: { barcodeNumber: string } }) {
  await ensureApiTables();
  const rows = await sql`SELECT * FROM products WHERE barcode = ${params.barcodeNumber} LIMIT 1`;
  if (!rows.length) return notFound('product not found');
  return ok(rows[0]);
}
