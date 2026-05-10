import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockEnsure, mockFetchOff } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockEnsure: vi.fn().mockResolvedValue(undefined),
  mockFetchOff: vi.fn(),
}));

vi.mock('../../../_lib/db', () => ({ sql: mockSql, ensureApiTables: mockEnsure }));
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
    mockSql.mockReset();
    mockFetchOff.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('cache hit: returns local row with source="cache" without calling OFF', async () => {
    const cached = { id: 42, barcode: BC, name: 'Cheerios', brand: 'General Mills' };
    mockSql.mockResolvedValueOnce([cached]);
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...cached, source: 'cache' });
    expect(mockFetchOff).not.toHaveBeenCalled();
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('cache miss + OFF hit: calls OFF, upserts, returns row with source="openfoodfacts"', async () => {
    mockSql
      .mockResolvedValueOnce([]) // SELECT cache miss
      .mockResolvedValueOnce([
        { id: 100, barcode: BC, name: 'Cheerios Original', brand: 'General Mills' },
      ]); // INSERT returning
    mockFetchOff.mockResolvedValueOnce({
      product_name: 'Cheerios Original',
      brands: 'General Mills',
      ingredients_text: 'Whole Grain Oats',
      categories_tags: ['en:cereals'],
      image_front_url: 'https://images.openfoodfacts.org/x.jpg',
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('openfoodfacts');
    expect(body.id).toBe(100);
    expect(mockFetchOff).toHaveBeenCalledWith(BC);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('cache miss + OFF miss: returns 404', async () => {
    mockSql.mockResolvedValueOnce([]);
    mockFetchOff.mockResolvedValueOnce(null);
    const res = await callGet();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not in catalog|not found/i);
  });

  it('cache miss + OFF throws (network/503): bubbles error (caller can decide retry)', async () => {
    mockSql.mockResolvedValueOnce([]);
    mockFetchOff.mockRejectedValueOnce(new Error('OpenFoodFacts unreachable'));
    await expect(callGet()).rejects.toThrow(/unreachable/i);
  });
});
