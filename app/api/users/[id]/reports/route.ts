import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, ok, parseId } from '../../../_lib/http';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  if (!userId) return badRequest('invalid user id');
  const rows = await sql`
    SELECT * FROM reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  return ok(rows);
}
