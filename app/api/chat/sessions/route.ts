/**
 * POST /api/chat/sessions — Create a new chat session for the caller.
 *
 * Body: optional `{ title?: string }`.
 *
 * Success `201`: `{ id, title, createdAt, updatedAt }`.
 *
 * GET /api/chat/sessions — List the caller's sessions.
 *
 * Query: `limit` (default 20, max 100), `offset` (default 0).
 *
 * Success `200`: `{ total, limit, offset, sessions: [{ id, title, updatedAt, messageCount }] }`.
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/proxy';
import { ok, validationError } from '../../_lib/http';

export const dynamic = 'force-dynamic';

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

const CreateSessionSchema = z
  .object({
    title: z.string().min(1).max(200).nullable().optional(),
  })
  .strict()
  .optional();

export async function GET(req: Request) {
  return requireAuth(req, async (caller) => {
    const u = new URL(req.url);
    const rawLimit = Number.parseInt(u.searchParams.get('limit') ?? '20', 10);
    const rawOffset = Number.parseInt(u.searchParams.get('offset') ?? '0', 10);
    const limit = Number.isFinite(rawLimit) ? clamp(rawLimit, 1, 100) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

    const where = { userId: caller.id };

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.chatSession.count({ where }),
    ]);

    const items = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages,
    }));

    return ok({ total, limit, offset, sessions: items });
  });
}

export async function POST(req: Request) {
  return requireAuth(req, async (caller) => {
    const raw = await req.json().catch(() => ({}));
    const parsed = CreateSessionSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.issues);

    const session = await prisma.chatSession.create({
      data: {
        userId: caller.id,
        title: parsed.data?.title ?? null,
      },
    });

    return ok(
      {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      201,
    );
  });
}
