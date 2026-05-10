import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const INTERNAL_KEY = 'test-internal-catalog-key';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    product: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { POST } from './route';

function callPost(body: unknown) {
  return POST(
    new Request('http://test/api/products', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${INTERNAL_KEY}`,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_API_KEY', INTERNAL_KEY);
    mockPrisma.product.upsert.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('201 with valid body upserts row', async () => {
    const created = { id: 42, barcodeNumber: '0037600100694', name: 'Cheerios' };
    mockPrisma.product.upsert.mockResolvedValueOnce(created);
    const res = await callPost({
      barcodeNumber: '0037600100694',
      name: 'Cheerios',
      brand: 'General Mills',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });

  it('400 when barcodeNumber missing', async () => {
    const res = await callPost({ name: 'Cheerios' });
    expect(res.status).toBe(400);
    expect(mockPrisma.product.upsert).not.toHaveBeenCalled();
  });

  it('400 when name missing', async () => {
    const res = await callPost({ barcodeNumber: '0037600100694' });
    expect(res.status).toBe(400);
    expect(mockPrisma.product.upsert).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON body', async () => {
    const res = await callPost('not-json{');
    expect(res.status).toBe(400);
    expect(mockPrisma.product.upsert).not.toHaveBeenCalled();
  });

  it('serializes nutritionalInfo object to JSON string in create payload', async () => {
    mockPrisma.product.upsert.mockResolvedValueOnce({ id: 1 });
    await callPost({
      barcodeNumber: 'x',
      name: 'y',
      nutritionalInfo: { calories: 100, sodium_mg: 140 },
    });
    const callArg = mockPrisma.product.upsert.mock.calls[0][0];
    expect(callArg.create.nutritionalInfo).toBe('{"calories":100,"sodium_mg":140}');
  });

  it('passes nullable optional fields through as null to create', async () => {
    mockPrisma.product.upsert.mockResolvedValueOnce({ id: 1 });
    await callPost({
      barcodeNumber: 'x',
      name: 'y',
      brand: null,
      ingredientList: null,
    });
    const callArg = mockPrisma.product.upsert.mock.calls[0][0];
    expect(callArg.create.brand).toBe(null);
    expect(callArg.create.ingredientList).toBe(null);
  });
});
