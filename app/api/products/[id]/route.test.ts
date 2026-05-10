import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { GET, PUT } from './route';

function callGet(id: string) {
  return GET(new Request(`http://test/api/products/${id}`), { params: { id } });
}

function callPut(id: string, body: unknown) {
  return PUT(
    new Request(`http://test/api/products/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: { id } },
  );
}

describe('GET /api/products/:id', () => {
  beforeEach(() => {
    mockPrisma.product.findUnique.mockReset();
  });

  it('returns 200 with row when product exists', async () => {
    const row = {
      id: 42,
      barcodeNumber: '0037600100694',
      name: 'Cheerios Original',
      brand: 'General Mills',
      ingredientList: 'Whole Grain Oats...',
    };
    mockPrisma.product.findUnique.mockResolvedValueOnce(row);
    const res = await callGet('42');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(row);
  });

  it('returns 404 when product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    expect((await callGet('999')).status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    expect((await callGet('abc')).status).toBe(400);
    expect(mockPrisma.product.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 for non-positive id', async () => {
    expect((await callGet('0')).status).toBe(400);
    expect((await callGet('-1')).status).toBe(400);
  });
});

describe('PUT /api/products/:id', () => {
  beforeEach(() => {
    mockPrisma.product.update.mockReset();
  });

  it('200 partial update returns updated row', async () => {
    const updated = { id: 42, name: 'Cheerios Updated', brand: 'GM' };
    mockPrisma.product.update.mockResolvedValueOnce(updated);
    const res = await callPut('42', { name: 'Cheerios Updated' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(updated);
  });

  it('404 when prisma.update throws (record not found)', async () => {
    mockPrisma.product.update.mockRejectedValueOnce(new Error('Record not found'));
    const res = await callPut('999', { name: 'x' });
    expect(res.status).toBe(404);
  });

  it('400 for invalid id', async () => {
    const res = await callPut('abc', { name: 'x' });
    expect(res.status).toBe(400);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('400 for invalid body JSON', async () => {
    const res = await callPut('1', 'not-json{');
    expect(res.status).toBe(400);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('400 when body attempts to set barcodeNumber (immutable, rejected by .strict())', async () => {
    const res = await callPut('1', { barcodeNumber: 'newone', name: 'x' });
    expect(res.status).toBe(400);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('serializes nutritionalInfo object to JSON string', async () => {
    mockPrisma.product.update.mockResolvedValueOnce({ id: 1 });
    await callPut('1', { nutritionalInfo: { calories: 100 } });
    const callArg = mockPrisma.product.update.mock.calls[0][0];
    expect(callArg.data.nutritionalInfo).toBe('{"calories":100}');
  });
});
