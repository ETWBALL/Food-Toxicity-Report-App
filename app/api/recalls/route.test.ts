import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    recall: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { GET } from './route';

function callGet(qs = '') {
  return GET(new Request(`http://test/api/recalls${qs ? '?' + qs : ''}`));
}

describe('GET /api/recalls', () => {
  beforeEach(() => {
    mockPrisma.recall.findMany.mockReset();
    mockPrisma.recall.count.mockReset();
  });

  it('returns wrapped {total, limit, offset, recalls} with default pagination', async () => {
    mockPrisma.recall.findMany.mockResolvedValueOnce([
      { id: 1, severityLevel: 'Class I' },
      { id: 2, severityLevel: 'Class II' },
    ]);
    mockPrisma.recall.count.mockResolvedValueOnce(47);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      total: 47,
      limit: 50,
      offset: 0,
      recalls: [
        { id: 1, severityLevel: 'Class I' },
        { id: 2, severityLevel: 'Class II' },
      ],
    });
  });

  it('respects custom limit and offset', async () => {
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    mockPrisma.recall.count.mockResolvedValueOnce(0);
    const res = await callGet('limit=10&offset=20');
    const body = await res.json();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(20);
  });

  it('clamps limit above 200 to 200', async () => {
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    mockPrisma.recall.count.mockResolvedValueOnce(0);
    const res = await callGet('limit=9999');
    expect((await res.json()).limit).toBe(200);
  });

  it('clamps negative offset to 0', async () => {
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    mockPrisma.recall.count.mockResolvedValueOnce(0);
    const res = await callGet('offset=-5');
    expect((await res.json()).offset).toBe(0);
  });

  it('passes severity, issuingAuthority, and active filters to prisma', async () => {
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    mockPrisma.recall.count.mockResolvedValueOnce(0);
    await callGet('severity=Class+I&issuingAuthority=FDA');
    const arg = mockPrisma.recall.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      active: true,
      severityLevel: 'Class I',
      issuingAuthority: 'FDA',
    });
  });

  it('drops active filter when includeInactive=true', async () => {
    mockPrisma.recall.findMany.mockResolvedValueOnce([]);
    mockPrisma.recall.count.mockResolvedValueOnce(0);
    await callGet('includeInactive=true');
    const arg = mockPrisma.recall.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({});
  });
});
