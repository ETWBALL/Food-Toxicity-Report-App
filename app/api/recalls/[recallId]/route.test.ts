import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    recall: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { GET } from './route';

function callGet(recallId: string) {
  return GET(new Request(`http://test/api/recalls/${recallId}`), { params: { recallId } });
}

describe('GET /api/recalls/:recallId', () => {
  beforeEach(() => {
    mockPrisma.recall.findUnique.mockReset();
  });

  it('returns 200 with row when recall exists', async () => {
    const row = {
      id: 9,
      recallNumber: 'F-0123-2026',
      severityLevel: 'Class I',
      recallReason: 'Undeclared peanuts',
      officialRecallUrl: 'https://www.accessdata.fda.gov/...',
      active: true,
    };
    mockPrisma.recall.findUnique.mockResolvedValueOnce(row);
    const res = await callGet('9');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(row);
    expect(mockPrisma.recall.findUnique).toHaveBeenCalledWith({ where: { id: 9 } });
  });

  it('returns 404 when recall does not exist', async () => {
    mockPrisma.recall.findUnique.mockResolvedValueOnce(null);
    const res = await callGet('999');
    expect(res.status).toBe(404);
  });

  it('returns 400 when recallId is non-numeric', async () => {
    const res = await callGet('abc');
    expect(res.status).toBe(400);
    expect(mockPrisma.recall.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 when recallId is zero or negative', async () => {
    expect((await callGet('0')).status).toBe(400);
    expect((await callGet('-5')).status).toBe(400);
    expect(mockPrisma.recall.findUnique).not.toHaveBeenCalled();
  });
});
