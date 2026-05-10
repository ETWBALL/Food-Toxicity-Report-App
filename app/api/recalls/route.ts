import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { ok } from '../_lib/http';

export const dynamic = 'force-dynamic';

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const severity = u.searchParams.get('severity') ?? undefined;
  const issuingAuthority = u.searchParams.get('issuingAuthority') ?? undefined;
  const includeInactive = u.searchParams.get('includeInactive') === 'true';

  const rawLimit = Number.parseInt(u.searchParams.get('limit') ?? '50', 10);
  const rawOffset = Number.parseInt(u.searchParams.get('offset') ?? '0', 10);
  const limit = Number.isFinite(rawLimit) ? clamp(rawLimit, 1, 200) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  const where: Prisma.RecallWhereInput = {
    ...(includeInactive ? {} : { active: true }),
    ...(severity ? { severityLevel: severity } : {}),
    ...(issuingAuthority ? { issuingAuthority } : {}),
  };

  const [recalls, total] = await Promise.all([
    prisma.recall.findMany({
      where,
      orderBy: [{ recallDate: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.recall.count({ where }),
  ]);

  return ok({ total, limit, offset, recalls });
}
