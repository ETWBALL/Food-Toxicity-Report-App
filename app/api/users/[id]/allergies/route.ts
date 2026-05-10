/**
 * GET /api/users/:id/allergies — list allergies `{ id, allergen, name, severity }[]`.
 *
 * POST /api/users/:id/allergies — body `{ allergen, name?, severity? }` (strict). Creates a row; `201` with created row.
 *
 * Auth: session required; `:id` must match caller. Errors: `401`, `403`, `400` validation.
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
    allergen: z.string().min(1).max(200),
    name: z.string().max(200).optional(),
    severity: z.string().max(64).optional(),
  })
  .strict();

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.userAllergy.findMany({
      where: { userId: caller.id },
      orderBy: { id: 'desc' },
      select: { id: true, allergen: true, name: true, severity: true },
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

    const inserted = await prisma.userAllergy.create({
      data: {
        userId: caller.id,
        allergen: parsed.data.allergen,
        name: parsed.data.name ?? parsed.data.allergen,
        severity: parsed.data.severity ?? null,
      },
      select: { id: true, allergen: true, name: true, severity: true },
    });

    return ok(inserted, 201);
  });
}
