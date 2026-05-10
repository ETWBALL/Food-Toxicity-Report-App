import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { parseUserRef, refMatchesCaller } from '@/lib/auth/user-ref';
import { requireAuth } from '@/lib/auth/proxy';
import type { User } from '@prisma/client';
import { badRequest, ok, parseId, validationError } from '../../../../_lib/http';

const putSchema = z
  .object({
    medicationName: z.string().min(1).max(200).optional(),
    dosage: z.string().max(200).nullable().optional(),
    frequency: z.string().max(200).nullable().optional(),
  })
  .strict();

export async function PUT(req: Request, { params }: { params: { id: string; medicationId: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const medicationId = parseId(params.medicationId);
    if (!medicationId) return badRequest('invalid medication id');

    const raw = await req.json().catch(() => null);
    const parsed = putSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.issues);

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return badRequest('no fields to update');
    }

    const result = await prisma.userMedication.updateMany({
      where: { id: medicationId, userId: caller.id },
      data: {
        ...(data.medicationName !== undefined ? { medicationName: data.medicationName } : {}),
        ...(data.dosage !== undefined ? { dosage: data.dosage } : {}),
        ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return ok({ success: true });
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string; medicationId: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const medicationId = parseId(params.medicationId);
    if (!medicationId) return badRequest('invalid medication id');

    const result = await prisma.userMedication.deleteMany({
      where: { id: medicationId, userId: caller.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return ok({ success: true });
  });
}
