import { ensureApiTables, sql } from '../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../_lib/http';

export async function GET(_: Request, { params }: { params: { reportId: string } }) {
  await ensureApiTables();
  const reportId = parseId(params.reportId);
  if (!reportId) return badRequest('invalid report id');
  const rows = await sql`SELECT * FROM reports WHERE id = ${reportId}`;
  if (!rows.length) return notFound('report not found');
  return ok(rows[0]);
}
