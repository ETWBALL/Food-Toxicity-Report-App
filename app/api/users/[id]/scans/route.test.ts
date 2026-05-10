import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    scanHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/proxy', () => ({ requireAuth: mockRequireAuth }));

import { GET } from './route';

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

function authReturns401() {
  const { NextResponse } = require('next/server');
  mockRequireAuth.mockImplementation(async () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  );
}

function callGet(idParam: string, qs = '') {
  return GET(
    new Request(`http://test/api/users/${idParam}/scans${qs ? '?' + qs : ''}`),
    { params: { id: idParam } },
  );
}

describe('GET /api/users/:id/scans', () => {
  beforeEach(() => {
    mockPrisma.scanHistory.findMany.mockReset();
    mockPrisma.scanHistory.count.mockReset();
    mockRequireAuth.mockReset();
  });

  it('401 when auth fails', async () => {
    authReturns401();
    const res = await callGet('42');
    expect(res.status).toBe(401);
    expect(mockPrisma.scanHistory.findMany).not.toHaveBeenCalled();
  });

  it('403 when path :id does not match caller (numeric id mismatch)', async () => {
    authPasses();
    const res = await callGet('999');
    expect(res.status).toBe(403);
    expect(mockPrisma.scanHistory.findMany).not.toHaveBeenCalled();
  });

  it('403 when path :id (publicId) does not match caller publicId', async () => {
    authPasses();
    const res = await callGet('someone_else');
    expect(res.status).toBe(403);
  });

  it('200 wraps scans with product join + verdict from safetyScore', async () => {
    authPasses();
    mockPrisma.scanHistory.findMany.mockResolvedValueOnce([
      {
        id: 301,
        productId: 7,
        scannedAt: new Date('2026-05-09T14:22:00Z'),
        safetyScore: 85,
        product: { id: 7, name: 'Cheerios', imageUrl: 'https://x' },
      },
    ]);
    mockPrisma.scanHistory.count.mockResolvedValueOnce(47);

    const res = await callGet('42');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(47);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.scans).toHaveLength(1);
    expect(body.scans[0]).toMatchObject({
      id: 301,
      productId: 7,
      productName: 'Cheerios',
      productImage: 'https://x',
      safetyScore: 85,
      verdict: 'Safe',
    });
  });

  it('clamps limit > 100 to 100 and offset < 0 to 0', async () => {
    authPasses();
    mockPrisma.scanHistory.findMany.mockResolvedValueOnce([]);
    mockPrisma.scanHistory.count.mockResolvedValueOnce(0);
    const res = await callGet('42', 'limit=9999&offset=-5');
    const body = await res.json();
    expect(body.limit).toBe(100);
    expect(body.offset).toBe(0);
  });

  it('200 when path :id matches caller publicId', async () => {
    authPasses();
    mockPrisma.scanHistory.findMany.mockResolvedValueOnce([]);
    mockPrisma.scanHistory.count.mockResolvedValueOnce(0);
    const res = await callGet('user_xyz');
    expect(res.status).toBe(200);
  });

  it('verdict null when safetyScore is null', async () => {
    authPasses();
    mockPrisma.scanHistory.findMany.mockResolvedValueOnce([
      {
        id: 1,
        productId: 1,
        scannedAt: new Date(),
        safetyScore: null,
        product: { id: 1, name: 'X', imageUrl: null },
      },
    ]);
    mockPrisma.scanHistory.count.mockResolvedValueOnce(1);
    const res = await callGet('42');
    const body = await res.json();
    expect(body.scans[0].verdict).toBe(null);
  });
});
