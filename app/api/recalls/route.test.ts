import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockEnsure } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockEnsure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_lib/db', () => ({
  sql: mockSql,
  ensureApiTables: mockEnsure,
}));

import { GET } from './route';

function callGet(qs = '') {
  return GET(new Request(`http://test/api/recalls${qs ? '?' + qs : ''}`));
}

describe('GET /api/recalls', () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('returns wrapped {total, limit, offset, recalls} with default pagination', async () => {
    mockSql
      .mockResolvedValueOnce([
        { id: 1, severity_level: 'Class I' },
        { id: 2, severity_level: 'Class II' },
      ]) // rows
      .mockResolvedValueOnce([{ count: 47 }]); // count

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      total: 47,
      limit: 50,
      offset: 0,
      recalls: [
        { id: 1, severity_level: 'Class I' },
        { id: 2, severity_level: 'Class II' },
      ],
    });
  });

  it('respects custom limit and offset', async () => {
    mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);
    const res = await callGet('limit=10&offset=20');
    const body = await res.json();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(20);
  });

  it('clamps limit above 200 to 200', async () => {
    mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);
    const res = await callGet('limit=9999');
    const body = await res.json();
    expect(body.limit).toBe(200);
  });

  it('clamps negative offset to 0', async () => {
    mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);
    const res = await callGet('offset=-5');
    const body = await res.json();
    expect(body.offset).toBe(0);
  });

  it('makes exactly 2 sql calls (rows + count)', async () => {
    mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);
    await callGet('severity=Class+I&issuingAuthority=FDA&includeInactive=true');
    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});
