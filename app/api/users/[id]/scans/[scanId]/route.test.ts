import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    scanHistory: { findFirst: vi.fn(), delete: vi.fn() },
    safetyReport: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
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

function callGet(idParam: string, scanId: string) {
  return GET(
    new Request(`http://test/api/users/${idParam}/scans/${scanId}`),
    { params: { id: idParam, scanId } },
  );
}

function callDelete(idParam: string, scanId: string) {
  return DELETE(
    new Request(`http://test/api/users/${idParam}/scans/${scanId}`, { method: 'DELETE' }),
    { params: { id: idParam, scanId } },
  );
}

describe('GET /api/users/:id/scans/:scanId', () => {
  beforeEach(() => {
    mockPrisma.scanHistory.findFirst.mockReset();
    mockRequireAuth.mockReset();
  });

  it('200 returns scan with product + latest report', async () => {
    authPasses();
    mockPrisma.scanHistory.findFirst.mockResolvedValueOnce({
      id: 301,
      productId: 7,
      scannedAt: new Date('2026-05-09T14:22:00Z'),
      score: 20,
      product: { id: 7, name: 'Cheerios', imageUrl: 'https://x' },
      safetyReports: [
        {
          id: 100,
          overallScore: 20,
          severityLevel: 'severe',
          allergenFlags: '["peanuts"]',
          drugFlags: null,
          toxicityFlags: null,
          potentialHarms: 'Allergic reaction risk',
          aiAnalysisSummary: 'Avoid this product',
          isPersonalized: true,
        },
      ],
    });
    const res = await callGet('42', '301');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scanId).toBe(301);
    expect(body.verdict).toBe('Unsafe');
    expect(body.product).toEqual({ id: 7, name: 'Cheerios', imageUrl: 'https://x' });
    expect(body.report.id).toBe(100);
  });

  it('200 with report=null when no safety report exists', async () => {
    authPasses();
    mockPrisma.scanHistory.findFirst.mockResolvedValueOnce({
      id: 301,
      productId: 7,
      scannedAt: new Date(),
      score: 85,
      product: { id: 7, name: 'X', imageUrl: null },
      safetyReports: [],
    });
    const res = await callGet('42', '301');
    const body = await res.json();
    expect(body.report).toBe(null);
    expect(body.verdict).toBe('Safe');
  });

  it('404 when scan not found OR not owned by caller', async () => {
    authPasses();
    mockPrisma.scanHistory.findFirst.mockResolvedValueOnce(null);
    const res = await callGet('42', '999');
    expect(res.status).toBe(404);
  });

  it('403 when path :id mismatches caller', async () => {
    authPasses();
    const res = await callGet('999', '301');
    expect(res.status).toBe(403);
    expect(mockPrisma.scanHistory.findFirst).not.toHaveBeenCalled();
  });

  it('400 when scanId is non-numeric', async () => {
    authPasses();
    const res = await callGet('42', 'abc');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/users/:id/scans/:scanId', () => {
  beforeEach(() => {
    mockPrisma.scanHistory.findFirst.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.safetyReport.deleteMany.mockReset();
    mockPrisma.scanHistory.delete.mockReset();
    mockRequireAuth.mockReset();
  });

  it('200 deletes scan + cascades safety reports in transaction', async () => {
    authPasses();
    mockPrisma.scanHistory.findFirst.mockResolvedValueOnce({ id: 301 });
    mockPrisma.$transaction.mockResolvedValueOnce([{ count: 1 }, { id: 301 }]);
    const res = await callDelete('42', '301');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, scanId: 301 });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('404 when scan not found', async () => {
    authPasses();
    mockPrisma.scanHistory.findFirst.mockResolvedValueOnce(null);
    const res = await callDelete('42', '999');
    expect(res.status).toBe(404);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('403 when path :id mismatches caller', async () => {
    authPasses();
    const res = await callDelete('999', '301');
    expect(res.status).toBe(403);
    expect(mockPrisma.scanHistory.findFirst).not.toHaveBeenCalled();
  });
});
