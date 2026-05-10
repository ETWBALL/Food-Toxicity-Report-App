import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    chatSession: { findFirst: vi.fn(), delete: vi.fn() },
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/proxy', () => ({ requireAuth: mockRequireAuth }));

import { GET, DELETE } from './route';

const CALLER = {
  id: 42,
  publicId: 'user_xyz',
  email: 'a@b.c',
  name: 'A',
  passwordHash: 'x',
  country: null,
  avatarUrl: null,
  age: null,
  createdAt: new Date(),
  deletedAt: null,
  tokenVersion: 0,
};

function authPasses() {
  mockRequireAuth.mockImplementation(async (_req, cb) => cb(CALLER));
}

function callGet(id: string) {
  return GET(new Request(`http://test/api/chat/sessions/${id}`), { params: { id } });
}

function callDelete(id: string) {
  return DELETE(new Request(`http://test/api/chat/sessions/${id}`, { method: 'DELETE' }), {
    params: { id },
  });
}

describe('GET /api/chat/sessions/:id', () => {
  beforeEach(() => {
    mockPrisma.chatSession.findFirst.mockReset();
    mockRequireAuth.mockReset();
  });

  it('200 returns session with messages', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce({
      id: 99,
      title: 'About Cheerios',
      createdAt: new Date('2026-05-10'),
      updatedAt: new Date('2026-05-10'),
      messages: [
        { id: 1, role: 'user', content: 'is this safe?', createdAt: new Date() },
        { id: 2, role: 'assistant', content: 'yes', createdAt: new Date() },
      ],
    });
    const res = await callGet('99');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(99);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('user');
  });

  it('404 when session not owned or missing', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce(null);
    const res = await callGet('999');
    expect(res.status).toBe(404);
  });

  it('400 when sessionId is non-numeric', async () => {
    authPasses();
    const res = await callGet('abc');
    expect(res.status).toBe(400);
    expect(mockPrisma.chatSession.findFirst).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/chat/sessions/:id', () => {
  beforeEach(() => {
    mockPrisma.chatSession.findFirst.mockReset();
    mockPrisma.chatSession.delete.mockReset();
    mockRequireAuth.mockReset();
  });

  it('200 deletes own session (cascades to messages via FK)', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce({ id: 99 });
    mockPrisma.chatSession.delete.mockResolvedValueOnce({ id: 99 });
    const res = await callDelete('99');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, sessionId: 99 });
    expect(mockPrisma.chatSession.delete).toHaveBeenCalledWith({ where: { id: 99 } });
  });

  it('404 when not owned', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce(null);
    const res = await callDelete('999');
    expect(res.status).toBe(404);
    expect(mockPrisma.chatSession.delete).not.toHaveBeenCalled();
  });
});
