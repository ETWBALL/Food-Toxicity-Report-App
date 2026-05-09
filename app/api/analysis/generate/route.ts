import { ensureApiTables, sql } from '../../_lib/db';
import { badRequest, ok } from '../../_lib/http';

export async function POST(req: Request) {
  await ensureApiTables();
  const body = await req.json().catch(() => null);
  if (!body?.productId || !body?.type) return badRequest('productId and type required');

  // Placeholder summary until provider wiring is done.
  const generated = {
    summary: `Analysis for product ${body.productId} (${body.type}) generated.`,
    generatedAt: new Date().toISOString(),
    risks: body.risks || [],
  };

  const rows = await sql`
    INSERT INTO ai_analysis_cache (product_id, analysis_type, content)
    VALUES (${body.productId}, ${body.type}, ${JSON.stringify(generated)}::jsonb)
    ON CONFLICT (product_id, analysis_type)
    DO UPDATE SET content = EXCLUDED.content, created_at = NOW()
    RETURNING *
  `;

  return ok(rows[0], 201);
}
