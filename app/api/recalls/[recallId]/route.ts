import { ensureApiTables, sql } from '../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../_lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { recallId: string } }) {
  await ensureApiTables();
  const recallId = parseId(params.recallId);
  if (!recallId) return badRequest('invalid recall id');
  const rows = await sql`SELECT * FROM recalls WHERE id = ${recallId}`;
  if (!rows.length) return notFound('recall not found');
  return ok(rows[0]);
}
