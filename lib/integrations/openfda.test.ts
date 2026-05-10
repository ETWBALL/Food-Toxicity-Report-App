import { describe, expect, it, vi } from 'vitest';

const { mockFetchJson } = vi.hoisted(() => ({
  mockFetchJson: vi.fn(),
}));

vi.mock('@/lib/integrations/fetch', () => ({
  fetchJson: mockFetchJson,
  openfdaKeyQuery: () => '',
}));

import { fetchFoodRecalls } from './openfda';

const PARADISE_FLAVORS = {
  product_description:
    'Ferrero Rocher, Ice-cream base, Hazelnut, Nutella, Penuts, Cacao, Rich Chocolate, Artificial flavoring., DISTRIBUTED BY: PARADISE FLAVORS LLC. 4oz. Packaged in plastic pouch. Frozen. — Undeclared allergen: Milk, tree nuts, peanuts, soy, and wheat.',
  recalling_firm: 'PARADISE FLAVORS LLC',
  classification: 'Class II',
  report_date: '20231122',
  reason_for_recall: 'Undeclared milk, tree nuts, peanuts, soy, and wheat',
};

const COOKIE_CAKE = {
  product_description:
    'Chocolate & the Chip Original Nutella Cookie cake Cookie cakes 1LB 1.4oz / 494 grams',
  recalling_firm: 'Chocolate & the Chip Inc',
  classification: 'Class II',
  report_date: '20211027',
  reason_for_recall: 'Undeclared wheat, milk, soy, tree nuts',
};

const REAL_NUTELLA_FIRM_MATCH = {
  product_description: 'Nutella & Go Hazelnut Spread with Breadsticks',
  recalling_firm: 'FERRERO USA INC',
  classification: 'Class III',
  report_date: '20260101',
  reason_for_recall: 'mislabeled lot',
};

const REAL_NUTELLA_DESC_MATCH = {
  product_description: 'NUTELLA Hazelnut Spread 13oz Jar',
  recalling_firm: 'Generic Repackager Inc',
  classification: 'Class II',
  report_date: '20260201',
  reason_for_recall: 'undeclared peanut',
};

describe('fetchFoodRecalls — false-positive filtering', () => {
  it('drops recalls where the search term appears only as an ingredient (comma-separated list)', async () => {
    mockFetchJson.mockResolvedValueOnce({ ok: true, data: { results: [PARADISE_FLAVORS] } });
    const out = await fetchFoodRecalls('Nutella', 'Nutella');
    expect(out).toEqual([]);
  });

  it('drops recalls where the search term is buried in a different product name', async () => {
    mockFetchJson.mockResolvedValueOnce({ ok: true, data: { results: [COOKIE_CAKE] } });
    const out = await fetchFoodRecalls('Nutella', 'Nutella');
    expect(out).toEqual([]);
  });

  it('keeps recalls when the recalling_firm matches the brand (manufacturer-level signal)', async () => {
    // brand "Ferrero" → firm "FERRERO USA INC" (substring match)
    mockFetchJson.mockResolvedValueOnce({ ok: true, data: { results: [REAL_NUTELLA_FIRM_MATCH] } });
    const out = await fetchFoodRecalls('Ferrero', 'Ferrero');
    expect(out).toHaveLength(1);
  });

  it('keeps recalls when product_description leads with the brand', async () => {
    mockFetchJson.mockResolvedValueOnce({ ok: true, data: { results: [REAL_NUTELLA_DESC_MATCH] } });
    const out = await fetchFoodRecalls('Nutella', 'Nutella');
    expect(out).toHaveLength(1);
  });

  it('mixed input: keeps real, drops false positives in same response', async () => {
    mockFetchJson.mockResolvedValueOnce({
      ok: true,
      data: { results: [PARADISE_FLAVORS, COOKIE_CAKE, REAL_NUTELLA_DESC_MATCH] },
    });
    const out = await fetchFoodRecalls('Nutella', 'Nutella');
    expect(out).toHaveLength(1);
    expect(out[0].recalling_firm).toBe('Generic Repackager Inc');
  });

  it('returns [] when fetch fails', async () => {
    mockFetchJson.mockResolvedValueOnce({ ok: false, error: 'timeout' });
    const out = await fetchFoodRecalls('Nutella', 'Nutella');
    expect(out).toEqual([]);
  });
});
