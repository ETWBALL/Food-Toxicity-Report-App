import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockEnsure } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockEnsure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../_lib/db', () => ({
  sql: mockSql,
  ensureApiTables: mockEnsure,
}));

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

describe('PUT /api/products/:id', () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('200 partial update returns updated row', async () => {
    const updated = { id: 42, name: 'Cheerios Updated', brand: 'GM' };
    mockSql.mockResolvedValueOnce([updated]);
    const res = await callPut('42', { name: 'Cheerios Updated' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(updated);
  });

  it('404 when product missing', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await callPut('999', { name: 'x' });
    expect(res.status).toBe(404);
  });

  it('400 for invalid id', async () => {
    const res = await callPut('abc', { name: 'x' });
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('400 for invalid body JSON', async () => {
    const res = await callPut('1', 'not-json{');
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('400 when body attempts to set barcode (immutable per spec)', async () => {
    const res = await callPut('1', { barcode: 'newone', name: 'x' });
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('200 accepts empty partial body (no fields)', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    const res = await callPut('1', {});
    expect(res.status).toBe(200);
  });
});
