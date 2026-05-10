import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/proxy';
import type { User } from '@prisma/client';
import { ok } from '../../../_lib/http';
import { verdictFromScore } from '../../../_lib/score';

export const dynamic = 'force-dynamic';

function parseUserRef(raw: string): { id: number } | { publicId: string } {
  if (/^\d+$/.test(raw)) {
    const id = Number(raw);
    if (id > 0) return { id };
  }
  return { publicId: raw };
}

function refMatchesCaller(ref: ReturnType<typeof parseUserRef>, caller: User): boolean {
  if ('id' in ref) return caller.id === ref.id;
  return caller.publicId === ref.publicId;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const u = new URL(req.url);
    const rawLimit = Number.parseInt(u.searchParams.get('limit') ?? '20', 10);
    const rawOffset = Number.parseInt(u.searchParams.get('offset') ?? '0', 10);
    const limit = Number.isFinite(rawLimit) ? clamp(rawLimit, 1, 100) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

    const where = { userId: caller.id };

    const [scans, total] = await Promise.all([
      prisma.scanHistory.findMany({
        where,
        orderBy: [{ scannedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
      prisma.scanHistory.count({ where }),
    ]);

    const items = scans.map((s) => ({
      id: s.id,
      productId: s.productId,
      productName: s.product?.name ?? null,
      productImage: s.product?.imageUrl ?? null,
      safetyScore: s.safetyScore,
      verdict: verdictFromScore(s.safetyScore),
      scannedAt: s.scannedAt,
    }));

    return ok({ total, limit, offset, scans: items });
  });
}
