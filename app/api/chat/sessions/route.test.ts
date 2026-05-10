import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    chatSession: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/proxy', () => ({ requireAuth: mockRequireAuth }));

import { GET, POST } from './route';

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

function callGet(qs = '') {
  return GET(new Request(`http://test/api/chat/sessions${qs ? '?' + qs : ''}`));
}

function callPost(body: unknown) {
  return POST(
    new Request('http://test/api/chat/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/chat/sessions', () => {
  beforeEach(() => {
    mockPrisma.chatSession.create.mockReset();
    mockRequireAuth.mockReset();
  });

  it('201 creates session with optional title', async () => {
    authPasses();
    const created = {
      id: 99,
      title: 'Quick question',
      createdAt: new Date('2026-05-10'),
      updatedAt: new Date('2026-05-10'),
    };
    mockPrisma.chatSession.create.mockResolvedValueOnce(created);
    const res = await callPost({ title: 'Quick question' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(99);
    expect(body.title).toBe('Quick question');
    expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
      data: { userId: 42, title: 'Quick question' },
    });
  });

  it('201 with no body title defaults to null', async () => {
    authPasses();
    mockPrisma.chatSession.create.mockResolvedValueOnce({
      id: 100,
      title: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await callPost({});
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe(null);
  });
});

describe('GET /api/chat/sessions', () => {
  beforeEach(() => {
    mockPrisma.chatSession.findMany.mockReset();
    mockPrisma.chatSession.count.mockReset();
    mockRequireAuth.mockReset();
  });

  it('200 returns wrapped {total, limit, offset, sessions[]}', async () => {
    authPasses();
    mockPrisma.chatSession.findMany.mockResolvedValueOnce([
      {
        id: 1,
        title: 'About Cheerios',
        createdAt: new Date('2026-05-09'),
        updatedAt: new Date('2026-05-09'),
        _count: { messages: 4 },
      },
    ]);
    mockPrisma.chatSession.count.mockResolvedValueOnce(1);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.sessions[0]).toMatchObject({
      id: 1,
      title: 'About Cheerios',
      messageCount: 4,
    });
  });

  it('clamps limit > 100 to 100', async () => {
    authPasses();
    mockPrisma.chatSession.findMany.mockResolvedValueOnce([]);
    mockPrisma.chatSession.count.mockResolvedValueOnce(0);
    const res = await callGet('limit=9999');
    expect((await res.json()).limit).toBe(100);
  });
});
