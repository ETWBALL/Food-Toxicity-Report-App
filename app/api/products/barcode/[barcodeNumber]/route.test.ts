import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockFetchOff } = vi.hoisted(() => ({
  mockPrisma: {
    product: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  mockFetchOff: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../../../_lib/openfoodfacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../_lib/openfoodfacts')>();
  return { ...actual, fetchProductByBarcode: mockFetchOff };
});

import { GET } from './route';

const BC = '0037600100694';

function callGet() {
  return GET(new Request(`http://test/api/products/barcode/${BC}`), {
    params: { barcodeNumber: BC },
  });
}

describe('GET /api/products/barcode/:bc', () => {
  beforeEach(() => {
    mockPrisma.product.findUnique.mockReset();
    mockPrisma.product.upsert.mockReset();
    mockFetchOff.mockReset();
  });

  it('cache hit returns local row with source="cache" without calling OFF or upsert', async () => {
    const cached = { id: 42, barcodeNumber: BC, name: 'Cheerios' };
    mockPrisma.product.findUnique.mockResolvedValueOnce(cached);
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...cached, source: 'cache' });
    expect(mockFetchOff).not.toHaveBeenCalled();
    expect(mockPrisma.product.upsert).not.toHaveBeenCalled();
  });

  it('cache miss + OFF hit upserts and returns row with source="openfoodfacts"', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    mockFetchOff.mockResolvedValueOnce({
      product_name: 'Cheerios Original',
      brands: 'General Mills',
      ingredients_text: 'Whole Grain Oats',
      categories_tags: ['en:cereals'],
      image_front_url: 'https://images.openfoodfacts.org/x.jpg',
    });
    mockPrisma.product.upsert.mockResolvedValueOnce({
      id: 100,
      barcodeNumber: BC,
      name: 'Cheerios Original',
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('openfoodfacts');
    expect(body.id).toBe(100);
    expect(mockFetchOff).toHaveBeenCalledWith(BC);
    expect(mockPrisma.product.upsert).toHaveBeenCalledTimes(1);
  });

  it('cache miss + OFF miss returns 404', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    mockFetchOff.mockResolvedValueOnce(null);
    const res = await callGet();
    expect(res.status).toBe(404);
    expect(mockPrisma.product.upsert).not.toHaveBeenCalled();
  });

  it('cache miss + OFF throws bubbles error', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    mockFetchOff.mockRejectedValueOnce(new Error('OpenFoodFacts unreachable'));
    await expect(callGet()).rejects.toThrow(/unreachable/i);
  });
});
