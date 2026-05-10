import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockRequireAuth, mockFetchOff, mockFetchDrugLabel, mockGenSummary } =
  vi.hoisted(() => ({
    mockPrisma: {
      scanHistory: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
      product: { findUnique: vi.fn(), upsert: vi.fn() },
      recall: { findMany: vi.fn() },
      userAllergy: { findMany: vi.fn() },
      userMedication: { findMany: vi.fn() },
      safetyReport: { create: vi.fn() },
      $transaction: vi.fn(),
    },
    mockRequireAuth: vi.fn(),
    mockFetchOff: vi.fn(),
    mockFetchDrugLabel: vi.fn(),
    mockGenSummary: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/proxy', () => ({ requireAuth: mockRequireAuth }));
vi.mock('../../../_lib/openfoodfacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../_lib/openfoodfacts')>();
  return { ...actual, fetchProductByBarcode: mockFetchOff };
});
vi.mock('../../../_lib/fda', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../_lib/fda')>();
  return { ...actual, fetchDrugLabel: mockFetchDrugLabel };
});
vi.mock('../../../_lib/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../_lib/ai')>();
  return { ...actual, generateScanSummary: mockGenSummary };
});

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

function callPost(idParam: string, body: unknown) {
  return POST(
    new Request(`http://test/api/users/${idParam}/scans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: { id: idParam } },
  );
}

const SCANNED_AT = new Date('2026-05-09T14:22:00Z');

function setupHappyPath(opts: {
  product?: { id: number; name: string; imageUrl: string | null; ingredientList: string | null };
  recalls?: Array<Record<string, unknown>>;
  allergies?: string[];
  medications?: string[];
} = {}) {
  const product = opts.product ?? {
    id: 7,
    name: 'Cheerios',
    imageUrl: 'https://x',
    ingredientList: 'Whole Grain Oats',
  };
  mockPrisma.product.findUnique.mockResolvedValueOnce(product);
  mockPrisma.recall.findMany.mockResolvedValueOnce(opts.recalls ?? []);
  mockPrisma.userAllergy.findMany.mockResolvedValueOnce(
    (opts.allergies ?? []).map((a) => ({ allergen: a })),
  );
  mockPrisma.userMedication.findMany.mockResolvedValueOnce(
    (opts.medications ?? []).map((m) => ({ medicationName: m })),
  );
  mockGenSummary.mockResolvedValueOnce('AI says: ok.');
  mockPrisma.$transaction.mockImplementationOnce(async (cb: any) => {
    return cb({
      scanHistory: { create: vi.fn().mockResolvedValueOnce({ id: 301, scannedAt: SCANNED_AT }) },
      safetyReport: { create: vi.fn().mockResolvedValueOnce({ id: 100 }) },
    });
  });
}

describe('POST /api/users/:id/scans (8-step orchestration)', () => {
  beforeEach(() => {
    Object.values(mockPrisma).forEach((m: any) => {
      if (typeof m === 'object') {
        Object.values(m).forEach((fn: any) => fn?.mockReset?.());
      }
    });
    mockPrisma.$transaction.mockReset();
    mockRequireAuth.mockReset();
    mockFetchOff.mockReset();
    mockFetchDrugLabel.mockReset();
    mockGenSummary.mockReset();
  });

  it('401 when auth fails', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    });
    const res = await callPost('42', { barcodeNumber: '0037600100694' });
    expect(res.status).toBe(401);
  });

  it('403 when caller does not own :id', async () => {
    authPasses();
    const res = await callPost('999', { barcodeNumber: '0037600100694' });
    expect(res.status).toBe(403);
  });

  it('400 when barcodeNumber missing', async () => {
    authPasses();
    const res = await callPost('42', {});
    expect(res.status).toBe(400);
  });

  it('404 when product not in cache and OFF returns null', async () => {
    authPasses();
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    mockFetchOff.mockResolvedValueOnce(null);
    const res = await callPost('42', { barcodeNumber: 'unknown_bc' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('PRODUCT_NOT_IN_CATALOG');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('happy path: cache hit, no flags, no recalls → score 100, Safe', async () => {
    authPasses();
    setupHappyPath();
    const res = await callPost('42', { barcodeNumber: '0037600100694' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.safetyScore).toBe(100);
    expect(body.verdict).toBe('Safe');
    expect(body.recallActive).toBe(false);
    expect(body.allergyFlags).toEqual([]);
    expect(body.drugFlags).toEqual([]);
    expect(body.scanId).toBe(301);
    expect(body.summary).toBe('AI says: ok.');
    expect(body.isPersonalized).toBe(false);
  });

  it('Class I recall hard-floors verdict to Unsafe (score 20)', async () => {
    authPasses();
    setupHappyPath({
      recalls: [
        {
          severityLevel: 'Class I',
          officialRecallUrl: 'https://accessdata.fda.gov/x',
        },
      ],
    });
    const res = await callPost('42', { barcodeNumber: '0037600100694' });
    const body = await res.json();
    expect(body.recallActive).toBe(true);
    expect(body.recallSeverity).toBe('Class I');
    expect(body.safetyScore).toBe(20);
    expect(body.verdict).toBe('Unsafe');
    expect(body.officialRecallUrl).toBe('https://accessdata.fda.gov/x');
  });

  it('allergen substring match populates allergyFlags and deducts -20 each', async () => {
    authPasses();
    setupHappyPath({
      product: { id: 7, name: 'Trail Mix', imageUrl: null, ingredientList: 'Peanuts, almonds, raisins' },
      allergies: ['peanuts', 'shellfish'], // peanuts hits, shellfish doesn't
    });
    const res = await callPost('42', { barcodeNumber: '0037600100694' });
    const body = await res.json();
    expect(body.allergyFlags).toEqual(['peanuts']);
    expect(body.safetyScore).toBe(80); // 100 - 20*1
    expect(body.verdict).toBe('Safe'); // 80 is the boundary
    expect(body.isPersonalized).toBe(true);
  });

  it('cache miss + OFF hit upserts product before continuing', async () => {
    authPasses();
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    mockFetchOff.mockResolvedValueOnce({
      product_name: 'New Product',
      ingredients_text: 'Sugar, salt',
    });
    mockPrisma.product.upsert.mockResolvedValueOnce({
      id: 99,
      name: 'New Product',
      imageUrl: null,
      ingredientList: 'Sugar, salt',
    });
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    mockPrisma.userAllergy.findMany.mockResolvedValueOnce([]);
    mockPrisma.userMedication.findMany.mockResolvedValueOnce([]);
    mockGenSummary.mockResolvedValueOnce('summary');
    mockPrisma.$transaction.mockImplementationOnce(async (cb: any) =>
      cb({
        scanHistory: { create: vi.fn().mockResolvedValueOnce({ id: 555, scannedAt: SCANNED_AT }) },
        safetyReport: { create: vi.fn().mockResolvedValueOnce({ id: 200 }) },
      }),
    );
    const res = await callPost('42', { barcodeNumber: 'newbc' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.productId).toBe(99);
    expect(mockPrisma.product.upsert).toHaveBeenCalledTimes(1);
  });
});
