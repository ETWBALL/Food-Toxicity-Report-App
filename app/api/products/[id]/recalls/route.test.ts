import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    product: { findUnique: vi.fn() },
    recall: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { GET } from './route';

function callGet(id: string, qs = '') {
  return GET(new Request(`http://test/api/products/${id}/recalls${qs ? '?' + qs : ''}`), {
    params: { id },
  });
}

describe('GET /api/products/:id/recalls', () => {
  beforeEach(() => {
    mockPrisma.product.findUnique.mockReset();
    mockPrisma.recall.findMany.mockReset();
  });

  it('returns {productId, activeRecalls, recalls} wrapper', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ barcodeNumber: '0037600100694' });
    mockPrisma.recall.findMany.mockResolvedValueOnce([
      { id: 9, active: true, severityLevel: 'Class I' },
    ]);
    const res = await callGet('42');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      productId: 42,
      activeRecalls: 1,
      recalls: [{ id: 9, active: true, severityLevel: 'Class I' }],
    });
  });

  it('activeRecalls counts only rows with active=true', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ barcodeNumber: 'x' });
    mockPrisma.recall.findMany.mockResolvedValueOnce([
      { id: 1, active: true, severityLevel: 'Class I' },
      { id: 2, active: false, severityLevel: 'Class III' },
      { id: 3, active: true, severityLevel: 'Class II' },
    ]);
    const res = await callGet('42', 'activeOnly=false');
    const body = await res.json();
    expect(body.activeRecalls).toBe(2);
    expect(body.recalls).toHaveLength(3);
  });

  it('returns empty wrapper when no recalls match', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ barcodeNumber: 'x' });
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    const res = await callGet('42');
    expect(await res.json()).toEqual({ productId: 42, activeRecalls: 0, recalls: [] });
  });

  it('skips affectedUpcCodes match when product has no barcode', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ barcodeNumber: null });
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    await callGet('42');
    const where = mockPrisma.recall.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ productId: 42 }]);
  });

  it('returns 400 for invalid product id', async () => {
    const res = await callGet('abc');
    expect(res.status).toBe(400);
    expect(mockPrisma.product.findUnique).not.toHaveBeenCalled();
  });
});
