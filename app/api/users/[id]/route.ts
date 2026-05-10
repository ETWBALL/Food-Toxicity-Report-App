import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { prisma } from '@/lib/prisma';
import { requireAuth, serializeUser } from '@/lib/auth/proxy';
import { userUpdateSchema } from '@/lib/validation/user';
import type { User } from '@prisma/client';
import { badRequest, validationError } from '../../_lib/http';

function parseUserRef(raw: string): { id: number } | { publicId: string } {
  if (/^\d+$/.test(raw)) {
    const id = Number(raw);
    if (id > 0) return { id };
  }
  return { publicId: raw };
}

function refMatchesCaller(ref: ReturnType<typeof parseUserRef>, caller: User): boolean {
  if ('id' in ref) {
    return caller.id === ref.id;
  }
  return caller.publicId === ref.publicId;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(serializeUser(caller));
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues);
    }

    const data = parsed.data;
    const updates: {
      name?: string;
      email?: string;
      country?: string | null;
      avatarUrl?: string | null;
      age?: number | null;
    } = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.country !== undefined) updates.country = data.country;
    if (data.age !== undefined) updates.age = data.age;

    if (data.avatarUrl !== undefined) {
      updates.avatarUrl = data.avatarUrl === '' ? null : data.avatarUrl;
    }

    if (data.email !== undefined) {
      const nextEmail = data.email.trim().toLowerCase();
      if (nextEmail !== caller.email) {
        const taken = await prisma.user.findUnique({ where: { email: nextEmail } });
        if (taken) {
          return badRequest('Email already in use');
        }
      }
      updates.email = nextEmail;
    }

    const updated =
      Object.keys(updates).length > 0
        ? await prisma.user.update({
            where: { id: caller.id },
            data: updates,
          })
        : caller;

    return NextResponse.json({ success: true, user: serializeUser(updated) });
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const disabledEmail = `deleted.${caller.publicId}.${Date.now()}@disabled.invalid`;

    await prisma.user.update({
      where: { id: caller.id },
      data: {
        deletedAt: new Date(),
        email: disabledEmail,
        tokenVersion: { increment: 1 },
      },
    });

    const res = NextResponse.json({
      success: true,
      message: 'Account deactivated; you may register again with your previous email.',
    });
    clearAuthCookies(res);
    return res;
  });
}
