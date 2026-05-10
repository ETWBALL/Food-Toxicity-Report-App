/**
 * GET /api/chat/sessions/:id — Load a single session with all its messages.
 *
 * Success `200`: `{ id, title, createdAt, updatedAt, messages: [{ id, role, content, createdAt }] }`.
 *
 * Errors: `401`, `404` if not found OR not owned by caller.
 *
 * DELETE /api/chat/sessions/:id — Delete the session (cascades to messages).
 *
 * Success `200`: `{ success: true, sessionId }`.
 */
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/proxy';
import { badRequest, notFound, ok, parseId } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const id = parseId(params.id);
    if (!id) return badRequest('invalid session id');

    const session = await prisma.chatSession.findFirst({
      where: { id, userId: caller.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) return notFound('session not found');

    return ok({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const id = parseId(params.id);
    if (!id) return badRequest('invalid session id');

    const found = await prisma.chatSession.findFirst({
      where: { id, userId: caller.id },
      select: { id: true },
    });
    if (!found) return notFound('session not found');

    await prisma.chatSession.delete({ where: { id } });
    return ok({ success: true, sessionId: id });
  });
}
