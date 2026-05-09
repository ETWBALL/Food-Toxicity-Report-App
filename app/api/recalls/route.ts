import { ensureApiTables, sql } from '../_lib/db';
import { ok } from '../_lib/http';

export async function GET() {
  await ensureApiTables();
  const rows = await sql`
    SELECT * FROM recalls
    WHERE active = TRUE
    ORDER BY recall_date DESC NULLS LAST, id DESC
  `;
  return ok(rows);
}
