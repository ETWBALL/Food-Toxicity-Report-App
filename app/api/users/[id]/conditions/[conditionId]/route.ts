import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { parseUserRef, refMatchesCaller } from '@/lib/auth/user-ref';
import { requireAuth } from '@/lib/auth/proxy';
import type { User } from '@prisma/client';
import { badRequest, ok, parseId, validationError } from '../../../../_lib/http';

const putSchema = z
  .object({
    conditionName: z.string().min(1).max(200).optional(),
    diagnosedAt: z.string().min(1).max(40).nullable().optional(),
  })
  .strict();

export async function PUT(req: Request, { params }: { params: { id: string; conditionId: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const conditionId = parseId(params.conditionId);
    if (!conditionId) return badRequest('invalid condition id');

    const raw = await req.json().catch(() => null);
    const parsed = putSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.issues);

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return badRequest('no fields to update');
    }

    const result = await prisma.userCondition.updateMany({
      where: { id: conditionId, userId: caller.id },
      data: {
        ...(data.conditionName !== undefined ? { conditionName: data.conditionName } : {}),
        ...(data.diagnosedAt !== undefined
          ? {
              diagnosedAt: data.diagnosedAt
                ? (() => {
                    const d = new Date(data.diagnosedAt);
                    return Number.isNaN(d.getTime()) ? null : d;
                  })()
                : null,
            }
          : {}),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return ok({ success: true });
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string; conditionId: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const conditionId = parseId(params.conditionId);
    if (!conditionId) return badRequest('invalid condition id');

    const result = await prisma.userCondition.deleteMany({
      where: { id: conditionId, userId: caller.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return ok({ success: true });
  });
}
