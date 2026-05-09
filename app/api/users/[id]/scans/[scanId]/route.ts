import { ensureApiTables, sql } from '../../../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../../../_lib/http';

export async function GET(_: Request, { params }: { params: { id: string; scanId: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const scanId = parseId(params.scanId);
  if (!userId || !scanId) return badRequest('invalid id');
  const rows = await sql`SELECT * FROM scan_history WHERE id = ${scanId} AND user_id = ${userId}`;
  if (!rows.length) return notFound('scan not found');
  return ok(rows[0]);
}

export async function DELETE(_: Request, { params }: { params: { id: string; scanId: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const scanId = parseId(params.scanId);
  if (!userId || !scanId) return badRequest('invalid id');
  await sql`DELETE FROM scan_history WHERE id = ${scanId} AND user_id = ${userId}`;
  return ok({ success: true });
}
