import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockEnsure } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockEnsure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../_lib/db', () => ({
  sql: mockSql,
  ensureApiTables: mockEnsure,
}));

import { GET } from './route';

function callGet(id: string) {
  return GET(new Request(`http://test/api/products/${id}`), { params: { id } });
}

describe('GET /api/products/:id', () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('returns 200 with row when product exists', async () => {
    const row = {
      id: 42,
      barcode: '0037600100694',
      name: 'Cheerios Original',
      brand: 'General Mills',
      ingredients: 'Whole Grain Oats...',
    };
    mockSql.mockResolvedValueOnce([row]);
    const res = await callGet('42');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(row);
  });

  it('returns 404 when product does not exist', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await callGet('999');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await callGet('abc');
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('returns 400 for non-positive id', async () => {
    const res = await callGet('0');
    expect(res.status).toBe(400);
    const res2 = await callGet('-1');
    expect(res2.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
