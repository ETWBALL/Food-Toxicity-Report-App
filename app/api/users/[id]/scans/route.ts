import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, ok, parseId } from '../../../_lib/http';

function verdictFromScore(score: number) {
  if (score >= 80) return 'Safe';
  if (score >= 50) return 'Caution';
  return 'Unsafe';
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  if (!userId) return badRequest('invalid user id');
  const rows = await sql`
    SELECT * FROM scan_history
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return ok(rows);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const body = await req.json().catch(() => null);
  if (!userId) return badRequest('invalid user id');
  if (!body?.barcode) return badRequest('barcode required');
  const score = Number.isFinite(body.score) ? Number(body.score) : 70;
  const verdict = body.verdict || verdictFromScore(score);
  const inserted = await sql`
    INSERT INTO scan_history (user_id, product_id, barcode, score, verdict)
    VALUES (${userId}, ${body.productId || null}, ${body.barcode}, ${score}, ${verdict})
    RETURNING *
  `;
  return ok(inserted[0], 201);
}
