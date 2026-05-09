import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockEnsure } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockEnsure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../_lib/db', () => ({
  sql: mockSql,
  ensureApiTables: mockEnsure,
}));

import { GET } from './route';

function callGet(id: string, qs = '') {
  return GET(new Request(`http://test/api/products/${id}/recalls${qs ? '?' + qs : ''}`), {
    params: { id },
  });
}

describe('GET /api/products/:id/recalls', () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('returns {productId, activeRecalls, recalls} wrapper', async () => {
    mockSql.mockResolvedValueOnce([
      { id: 9, active: true, severity_level: 'Class I' },
    ]);
    const res = await callGet('42');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      productId: 42,
      activeRecalls: 1,
      recalls: [{ id: 9, active: true, severity_level: 'Class I' }],
    });
  });

  it('activeRecalls counts only rows with active=true', async () => {
    mockSql.mockResolvedValueOnce([
      { id: 1, active: true, severity_level: 'Class I' },
      { id: 2, active: false, severity_level: 'Class III' },
      { id: 3, active: true, severity_level: 'Class II' },
    ]);
    const res = await callGet('42', 'activeOnly=false');
    const body = await res.json();
    expect(body.activeRecalls).toBe(2);
    expect(body.recalls).toHaveLength(3);
  });

  it('returns empty wrapper when no recalls match', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await callGet('42');
    expect(await res.json()).toEqual({ productId: 42, activeRecalls: 0, recalls: [] });
  });

  it('returns 400 for invalid product id', async () => {
    const res = await callGet('abc');
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
