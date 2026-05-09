import { ensureApiTables, sql } from '../../../../_lib/db';
import { badRequest, ok, parseId } from '../../../../_lib/http';

export async function DELETE(_: Request, { params }: { params: { id: string; allergyId: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const allergyId = parseId(params.allergyId);
  if (!userId || !allergyId) return badRequest('invalid id');
  await sql`DELETE FROM user_allergies WHERE id = ${allergyId} AND user_id = ${userId}`;
  return ok({ success: true });
}
