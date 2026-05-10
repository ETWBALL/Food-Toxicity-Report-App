import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    product: { findUnique: vi.fn() },
    recall: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { POST } from './route';

const BC = '0037600100694';

function callPost(barcodeNumber = BC) {
  return POST(new Request(`http://test/api/recalls/check/${barcodeNumber}`), {
    params: { barcodeNumber },
  });
}

describe('POST /api/recalls/check/:barcodeNumber', () => {
  beforeEach(() => {
    mockPrisma.product.findUnique.mockReset();
    mockPrisma.recall.findMany.mockReset();
  });

  it('returns hasRecall=false with empty recalls when nothing matches', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    const res = await callPost();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      barcodeNumber: BC,
      hasRecall: false,
      worstSeverity: null,
      activeRecallCount: 0,
      recalls: [],
    });
  });

  it('returns worstSeverity="Class I" with multi-recall mixed classes', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 42 });
    mockPrisma.recall.findMany.mockResolvedValueOnce([
      { id: 1, severityLevel: 'Class III' },
      { id: 2, severityLevel: 'Class I' },
      { id: 3, severityLevel: 'Class II' },
    ]);
    const res = await callPost();
    const body = await res.json();
    expect(body.hasRecall).toBe(true);
    expect(body.worstSeverity).toBe('Class I');
    expect(body.activeRecallCount).toBe(3);
  });

  it('skips productId predicate when product is unknown', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    await callPost();
    const where = mockPrisma.recall.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ affectedUpcCodes: { contains: BC } }]);
  });

  it('null severity rows produce worstSeverity=null', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 42 });
    mockPrisma.recall.findMany.mockResolvedValueOnce([
      { id: 5, severityLevel: null },
    ]);
    const body = await (await callPost()).json();
    expect(body.hasRecall).toBe(true);
    expect(body.worstSeverity).toBe(null);
    expect(body.activeRecallCount).toBe(1);
  });
});
