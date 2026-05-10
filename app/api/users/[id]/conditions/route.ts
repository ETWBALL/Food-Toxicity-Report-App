/**
 * GET /api/users/:id/conditions — list `{ id, conditionName, name, diagnosedAt }[]`.
 *
 * POST — `{ conditionName, name?, diagnosedAt? }` (ISO-ish date string optional). `201` with row.
 *
 * Session + caller `:id` match required.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { parseUserRef, refMatchesCaller } from '@/lib/auth/user-ref';
import { requireAuth } from '@/lib/auth/proxy';
import type { User } from '@prisma/client';
import { badRequest, ok, validationError } from '../../../_lib/http';

const postSchema = z
  .object({
    conditionName: z.string().min(1).max(200),
    name: z.string().max(200).optional(),
    diagnosedAt: z.string().min(1).max(40).nullable().optional(),
  })
  .strict();

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.userCondition.findMany({
      where: { userId: caller.id },
      orderBy: { id: 'desc' },
      select: { id: true, conditionName: true, name: true, diagnosedAt: true },
    });

    return ok(rows);
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.issues);

    const inserted = await prisma.userCondition.create({
      data: {
        userId: caller.id,
        conditionName: parsed.data.conditionName,
        name: parsed.data.name ?? parsed.data.conditionName,
        diagnosedAt: (() => {
          if (!parsed.data.diagnosedAt) return null;
          const d = new Date(parsed.data.diagnosedAt);
          return Number.isNaN(d.getTime()) ? null : d;
        })(),
      },
      select: { id: true, conditionName: true, name: true, diagnosedAt: true },
    });

    return ok(inserted, 201);
  });
}
