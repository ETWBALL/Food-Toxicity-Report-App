import { ensureApiTables, sql } from '../_lib/db';
import { ok } from '../_lib/http';

export const dynamic = 'force-dynamic';

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  await ensureApiTables();
  const u = new URL(req.url);

  const severity = u.searchParams.get('severity') || null;
  const issuingAuthority = u.searchParams.get('issuingAuthority') || null;
  const includeInactive = u.searchParams.get('includeInactive') === 'true';

  const rawLimit = Number.parseInt(u.searchParams.get('limit') || '50', 10);
  const rawOffset = Number.parseInt(u.searchParams.get('offset') || '0', 10);
  const limit = Number.isFinite(rawLimit) ? clamp(rawLimit, 1, 200) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  const rows = await sql`
    SELECT * FROM recalls
    WHERE (${includeInactive}::boolean OR active = TRUE)
      AND (${severity}::text IS NULL OR severity_level = ${severity})
      AND (${issuingAuthority}::text IS NULL OR source = ${issuingAuthority})
    ORDER BY recall_date DESC NULLS LAST, id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalRows = await sql`
    SELECT COUNT(*)::int AS count FROM recalls
    WHERE (${includeInactive}::boolean OR active = TRUE)
      AND (${severity}::text IS NULL OR severity_level = ${severity})
      AND (${issuingAuthority}::text IS NULL OR source = ${issuingAuthority})
  `;
  const total = totalRows[0]?.count ?? 0;

  return ok({ total, limit, offset, recalls: rows });
}
