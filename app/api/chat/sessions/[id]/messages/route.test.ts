import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockRequireAuth, mockFeatherless } = vi.hoisted(() => ({
  mockPrisma: {
    chatSession: { findFirst: vi.fn(), update: vi.fn() },
    chatMessage: { findMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    safetyReport: { findMany: vi.fn() },
    userMemory: { findMany: vi.fn(), createMany: vi.fn() },
  },
  mockRequireAuth: vi.fn(),
  mockFeatherless: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/proxy', () => ({ requireAuth: mockRequireAuth }));
vi.mock('@/lib/integrations/featherless', () => ({ featherlessChat: mockFeatherless }));

import { POST } from './route';

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

function setupContext() {
  mockPrisma.user.findUnique.mockResolvedValueOnce({
    ...CALLER,
    allergies: [],
    conditions: [],
    medications: [],
  });
  mockPrisma.safetyReport.findMany
    .mockResolvedValueOnce([]) // focusReports (empty when no reports passed)
    .mockResolvedValueOnce([]); // recentReports
  mockPrisma.userMemory.findMany.mockResolvedValueOnce([]);
}

function callPost(sessionId: string, body: unknown) {
  return POST(
    new Request(`http://test/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id: sessionId } },
  );
}

describe('POST /api/chat/sessions/:id/messages', () => {
  beforeEach(() => {
    Object.values(mockPrisma).forEach((m: any) =>
      Object.values(m).forEach((fn: any) => fn?.mockReset?.()),
    );
    mockRequireAuth.mockReset();
    mockFeatherless.mockReset();
    process.env.FEATHERLESS_API_KEY = 'test-key';
  });

  it('404 when session not owned', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce(null);
    const res = await callPost('99', { content: 'hi' });
    expect(res.status).toBe(404);
    expect(mockFeatherless).not.toHaveBeenCalled();
  });

  it('400 when content is empty', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce({ id: 99, title: null });
    const res = await callPost('99', { content: '' });
    expect(res.status).toBe(400);
    expect(mockFeatherless).not.toHaveBeenCalled();
  });

  it('500 when FEATHERLESS_API_KEY missing', async () => {
    delete process.env.FEATHERLESS_API_KEY;
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce({ id: 99, title: null });
    const res = await callPost('99', { content: 'hi' });
    expect(res.status).toBe(500);
  });

  it('201 happy path: persists user msg, calls Featherless, persists assistant msg, auto-titles', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce({ id: 99, title: null });
    mockPrisma.chatMessage.create
      .mockResolvedValueOnce({
        id: 1,
        role: 'user',
        content: 'is cheerios safe',
        createdAt: new Date('2026-05-10T00:00:00Z'),
      })
      .mockResolvedValueOnce({
        id: 2,
        role: 'assistant',
        content: 'Yes, mostly safe.',
        createdAt: new Date('2026-05-10T00:00:01Z'),
      });
    mockPrisma.chatMessage.findMany.mockResolvedValueOnce([]); // history
    setupContext();
    mockFeatherless
      .mockResolvedValueOnce('Yes, mostly safe.') // chat reply
      .mockResolvedValueOnce('NONE'); // memory extraction returns NONE
    mockPrisma.chatSession.update.mockResolvedValueOnce({ id: 99 });

    const res = await callPost('99', { content: 'is cheerios safe' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assistantMessage.content).toBe('Yes, mostly safe.');
    expect(body.userMessage.content).toBe('is cheerios safe');
    expect(body.sessionTitle).toBe('is cheerios safe');
    expect(mockFeatherless).toHaveBeenCalledTimes(2); // chat + extraction
    expect(mockPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({ title: 'is cheerios safe' }),
    });
  });

  it('502 when Featherless throws (user msg still persisted)', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce({ id: 99, title: null });
    mockPrisma.chatMessage.create.mockResolvedValueOnce({
      id: 1,
      role: 'user',
      content: 'hi',
      createdAt: new Date(),
    });
    mockPrisma.chatMessage.findMany.mockResolvedValueOnce([]);
    setupContext();
    mockFeatherless.mockRejectedValueOnce(new Error('Featherless request failed: 503'));

    const res = await callPost('99', { content: 'hi' });
    expect(res.status).toBe(502);
    // user msg still created exactly once
    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(1);
  });

  it('rejects > 3 focus reports (zod max)', async () => {
    authPasses();
    mockPrisma.chatSession.findFirst.mockResolvedValueOnce({ id: 99, title: null });
    const res = await callPost('99', { content: 'hi', reports: [1, 2, 3, 4] });
    expect(res.status).toBe(400);
    expect(mockFeatherless).not.toHaveBeenCalled();
  });
});
