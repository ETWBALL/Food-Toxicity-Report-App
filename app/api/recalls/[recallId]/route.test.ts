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

function callGet(recallId: string) {
  return GET(new Request(`http://test/api/recalls/${recallId}`), {
    params: { recallId },
  });
}

describe('GET /api/recalls/:recallId', () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('returns 200 with the row when recall exists', async () => {
    const row = {
      id: 9,
      recall_number: 'F-0123-2026',
      severity_level: 'Class I',
      recall_reason: 'Undeclared peanuts',
      official_recall_url: 'https://www.accessdata.fda.gov/...',
      active: true,
    };
    mockSql.mockResolvedValueOnce([row]);
    const res = await callGet('9');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(row);
  });

  it('returns 404 when recall does not exist', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await callGet('999');
    expect(res.status).toBe(404);
  });

  it('returns 400 when recallId is non-numeric', async () => {
    const res = await callGet('abc');
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('returns 400 when recallId is zero or negative', async () => {
    const res = await callGet('0');
    expect(res.status).toBe(400);
    const res2 = await callGet('-5');
    expect(res2.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
