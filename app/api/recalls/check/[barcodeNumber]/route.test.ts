import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockEnsure } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockEnsure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../_lib/db', () => ({
  sql: mockSql,
  ensureApiTables: mockEnsure,
}));

import { POST } from './route';

function callPost(barcodeNumber: string) {
  return POST(new Request(`http://test/api/recalls/check/${barcodeNumber}`), {
    params: { barcodeNumber },
  });
}

describe('POST /api/recalls/check/:barcodeNumber', () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockEnsure.mockReset();
    mockEnsure.mockResolvedValue(undefined);
  });

  it('returns hasRecall=false with empty recalls when no rows match', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await callPost('0037600100694');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      barcodeNumber: '0037600100694',
      hasRecall: false,
      worstSeverity: null,
      activeRecallCount: 0,
      recalls: [],
    });
  });

  it('returns worstSeverity="Class I" when multiple recalls match with mixed classes', async () => {
    mockSql.mockResolvedValueOnce([
      { id: 1, severity_level: 'Class III', recall_reason: 'minor labeling' },
      { id: 2, severity_level: 'Class I', recall_reason: 'undeclared peanuts' },
      { id: 3, severity_level: 'Class II', recall_reason: 'mislabel' },
    ]);
    const res = await callPost('0037600100694');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasRecall).toBe(true);
    expect(body.worstSeverity).toBe('Class I');
    expect(body.activeRecallCount).toBe(3);
    expect(body.recalls).toHaveLength(3);
    expect(body.barcodeNumber).toBe('0037600100694');
  });

  it('returns worstSeverity null when severity column is null on all rows', async () => {
    mockSql.mockResolvedValueOnce([
      { id: 5, severity_level: null, recall_reason: 'unknown severity' },
    ]);
    const res = await callPost('0037600100694');
    const body = await res.json();
    expect(body.hasRecall).toBe(true);
    expect(body.worstSeverity).toBe(null);
    expect(body.activeRecallCount).toBe(1);
  });
});
