import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockEnsure } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockEnsure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_lib/db', () => ({ sql: mockSql, ensureApiTables: mockEnsure }));

import { POST } from './route';

function callPost(body: unknown) {
  return POST(
    new Request('http://test/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('POST /api/products', () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('201 with valid body creates row', async () => {
    const created = { id: 42, barcode: '0037600100694', name: 'Cheerios' };
    mockSql.mockResolvedValueOnce([created]);
    const res = await callPost({
      barcode: '0037600100694',
      name: 'Cheerios',
      brand: 'General Mills',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });

  it('400 when barcode missing', async () => {
    const res = await callPost({ name: 'Cheerios' });
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('400 when name missing', async () => {
    const res = await callPost({ barcode: '0037600100694' });
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON body', async () => {
    const res = await callPost('not-json{');
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('accepts nullable optional fields', async () => {
    const created = { id: 1, barcode: 'x', name: 'y' };
    mockSql.mockResolvedValueOnce([created]);
    const res = await callPost({
      barcode: 'x',
      name: 'y',
      brand: null,
      ingredients: null,
      nutritionalInfo: null,
      imageUrl: null,
      type: null,
    });
    expect(res.status).toBe(201);
  });

  it('accepts nutritionalInfo as object', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    const res = await callPost({
      barcode: 'x',
      name: 'y',
      nutritionalInfo: { calories: 100, sodium_mg: 140 },
    });
    expect(res.status).toBe(201);
  });
});
