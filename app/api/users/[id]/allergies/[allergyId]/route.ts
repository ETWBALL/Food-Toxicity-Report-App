/**
 * DELETE /api/users/:id/allergies/:allergyId
 *
 * Deletes one allergy row owned by the caller. `:allergyId` must be a positive integer string.
 *
 * Success `200`: `{ success: true }`. `404` if no row deleted. `400` bad id. `403` user mismatch.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseUserRef, refMatchesCaller } from '@/lib/auth/user-ref';
import { requireAuth } from '@/lib/auth/proxy';
import type { User } from '@prisma/client';
import { badRequest, ok, parseId } from '../../../../_lib/http';

export async function DELETE(req: Request, { params }: { params: { id: string; allergyId: string } }) {
  return requireAuth(req, async (caller: User) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allergyId = parseId(params.allergyId);
    if (!allergyId) return badRequest('invalid allergy id');

    const result = await prisma.userAllergy.deleteMany({
      where: { id: allergyId, userId: caller.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return ok({ success: true });
  });
}
