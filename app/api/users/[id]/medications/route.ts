/**
 * GET /api/users/:id/medications — list `{ id, medicationName, name, dosage, frequency }[]`.
 *
 * POST — body `{ medicationName, name?, dosage?, frequency? }` (strict). `201` with created row.
 *
 * Session required; `:id` must match caller (`401`/`403`).
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
    medicationName: z.string().min(1).max(200),
    name: z.string().max(200).optional(),
    dosage: z.string().max(200).nullable().optional(),
    frequency: z.string().max(200).nullable().optional(),
  })
  .strict();

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.userMedication.findMany({
      where: { userId: caller.id },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        medicationName: true,
        name: true,
        dosage: true,
        frequency: true,
      },
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

    const inserted = await prisma.userMedication.create({
      data: {
        userId: caller.id,
        medicationName: parsed.data.medicationName,
        name: parsed.data.name ?? parsed.data.medicationName,
        dosage: parsed.data.dosage ?? null,
        frequency: parsed.data.frequency ?? null,
      },
      select: {
        id: true,
        medicationName: true,
        name: true,
        dosage: true,
        frequency: true,
      },
    });

    return ok(inserted, 201);
  });
}
