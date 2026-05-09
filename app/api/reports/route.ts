import { ensureApiTables, sql } from '../_lib/db';
import { badRequest, ok } from '../_lib/http';

function verdictFromScore(score: number) {
  if (score >= 80) return 'Safe';
  if (score >= 50) return 'Caution';
  return 'Unsafe';
}

export async function POST(req: Request) {
  await ensureApiTables();
  const body = await req.json().catch(() => null);
  if (!body?.userId || !body?.productId) return badRequest('userId and productId required');
  const score = Number.isFinite(body.score) ? Number(body.score) : 70;
  const verdict = body.verdict || verdictFromScore(score);
  const report = await sql`
    INSERT INTO reports (user_id, product_id, scan_id, score, verdict, potential_harms, summary)
    VALUES (
      ${body.userId},
      ${body.productId},
      ${body.scanId || null},
      ${score},
      ${verdict},
      ${JSON.stringify(body.potentialHarms || [])}::jsonb,
      ${body.summary || null}
    )
    RETURNING *
  `;
  return ok(report[0], 201);
}
