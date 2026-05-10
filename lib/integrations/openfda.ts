import { fetchJson, openfdaKeyQuery } from '@/lib/integrations/fetch';

export type OpenfdaRecallRow = {
  report_date?: string;
  recall_initiation_date?: string;
  status?: string;
  product_description?: string;
  reason_for_recall?: string;
  recalling_firm?: string;
  classification?: string;
};

export type OpenfdaAdverseRow = {
  safetyreportid?: string;
  receive_date?: string;
  patient?: {
    patientonsetage?: string;
    drug?: Array<{ medicinalproduct?: string; openfda?: { brand_name?: string[] } }>;
  };
};

/** CAERS / food adverse event report (openFDA food/event). */
export type OpenfdaFoodEventRow = {
  report_number?: string;
  date_started?: string;
  products?: Array<{ brand_name?: string; role?: string; industry_code?: string }>;
  reactions?: Array<{ reactions_med_drug?: string }>;
};

function keySuffix(): string {
  return openfdaKeyQuery();
}

function startsWithTerm(desc: string, term: string): boolean {
  if (!desc || !term) return false;
  // A real product recall usually leads with the product/brand name.
  // Tolerate up to a short prefix (e.g. "The ", "Original ") before the term.
  const head = desc.slice(0, Math.max(term.length + 16, 24));
  return head.includes(term);
}

/**
 * Keep only recalls that are HIGH-CONFIDENCE matches for the scanned product.
 * FDA enforcement records' `product_description` is free-text — it commonly
 * contains the search term as an INGREDIENT or BRANDING WORD inside a totally
 * different product. We've observed:
 *
 *   "Ferrero Rocher, Ice-cream base, Hazelnut, Nutella, Penuts, Cacao..."
 *     ← Nutella is listed as an ingredient of a Paradise Flavors frozen pouch.
 *   "Chocolate & the Chip Original Nutella Cookie cake Cookie cakes 1LB 1.4oz"
 *     ← Nutella is part of a cookie product NAME, not the Nutella jar itself.
 *
 * Both render terrifying recall warnings on the report when neither has any
 * relation to the scanned barcode. Filter strictly:
 *
 *   - KEEP when `recalling_firm` matches the product brand (firm-level signal)
 *   - KEEP when `product_description` HEADS with the brand (≈ "first 20 chars")
 *   - drop everything else
 *
 * This is intentionally conservative: better to miss an obscure recall than
 * to display a recall that isn't the user's product.
 */
function filterRelevantRecalls(
  rows: OpenfdaRecallRow[],
  searchTerm: string,
  brand?: string,
): OpenfdaRecallRow[] {
  const term = searchTerm.toLowerCase().trim();
  const brandLc = brand?.toLowerCase().trim() ?? '';
  return rows.filter((r) => {
    const desc = (r.product_description ?? '').toLowerCase();
    const firm = (r.recalling_firm ?? '').toLowerCase();
    if (brandLc && firm.includes(brandLc)) return true;
    if (brandLc && startsWithTerm(desc, brandLc)) return true;
    if (term && startsWithTerm(desc, term)) return true;
    return false;
  });
}

/** Food recalls (enforcement reports). Latest-first; narrow by product text when possible. */
export async function fetchFoodRecalls(
  searchTerm: string,
  brand?: string,
): Promise<OpenfdaRecallRow[]> {
  const term = searchTerm.trim().slice(0, 80);
  if (!term) return [];

  const base = 'https://api.fda.gov/food/enforcement.json';
  const search = `product_description:"${term.replace(/"/g, '')}"`;
  const url = `${base}?search=${encodeURIComponent(search)}&limit=25&sort=report_date:desc${keySuffix()}`;
  const res = await fetchJson<{ results?: OpenfdaRecallRow[] }>(url, { timeoutMs: 14_000 });
  if (!res.ok || !res.data.results?.length) return [];

  const relevant = filterRelevantRecalls(res.data.results, term, brand);
  if (!relevant.length) return [];

  const since2025 = (d?: string) => {
    if (!d) return false;
    const y = Number(d.slice(0, 4));
    return y >= 2025;
  };

  const recent = relevant.filter((r) => since2025(r.report_date || r.recall_initiation_date));
  return recent.length ? recent : relevant.slice(0, 15);
}

/** Drug/device recall enforcement (human drug recalls). */
export async function fetchDrugRecalls(
  searchTerm: string,
  brand?: string,
): Promise<OpenfdaRecallRow[]> {
  const term = searchTerm.trim().slice(0, 80);
  if (!term) return [];

  const base = 'https://api.fda.gov/drug/enforcement.json';
  const search = `product_description:"${term.replace(/"/g, '')}"`;
  const url = `${base}?search=${encodeURIComponent(search)}&limit=25&sort=report_date:desc${keySuffix()}`;
  const res = await fetchJson<{ results?: OpenfdaRecallRow[] }>(url, { timeoutMs: 14_000 });
  if (!res.ok || !res.data.results?.length) return [];

  const relevant = filterRelevantRecalls(res.data.results, term, brand);
  return relevant.slice(0, 15);
}

/** FAERS drug adverse events (latest slice). */
export async function fetchDrugAdverseEvents(brandOrName: string): Promise<OpenfdaAdverseRow[]> {
  const term = brandOrName.trim().slice(0, 80);
  if (!term) return [];

  const base = 'https://api.fda.gov/drug/event.json';
  const search = `patient.drug.openfda.brand_name:"${term.replace(/"/g, '')}"`;
  const url = `${base}?search=${encodeURIComponent(search)}&limit=25&sort=receivedate:desc${keySuffix()}`;
  const res = await fetchJson<{ results?: OpenfdaAdverseRow[] }>(url, { timeoutMs: 14_000 });
  if (!res.ok || !res.data.results?.length) return [];
  return res.data.results.slice(0, 15);
}

/** Food / dietary supplement adverse reports (CAERS-style via openFDA food/event). */
export async function fetchFoodAdverseEvents(brandOrName: string): Promise<OpenfdaFoodEventRow[]> {
  const term = brandOrName.trim().slice(0, 80);
  if (!term) return [];

  const base = 'https://api.fda.gov/food/event.json';
  const search = `products.brand_name:"${term.replace(/"/g, '')}"`;
  let url = `${base}?search=${encodeURIComponent(search)}&limit=20&sort=date_started:desc${keySuffix()}`;
  let res = await fetchJson<{ results?: OpenfdaFoodEventRow[] }>(url, { timeoutMs: 14_000 });
  if (!res.ok || !res.data.results?.length) {
    url = `${base}?search=${encodeURIComponent(search)}&limit=20${keySuffix()}`;
    res = await fetchJson<{ results?: OpenfdaFoodEventRow[] }>(url, { timeoutMs: 14_000 });
  }
  if (!res.ok || !res.data.results?.length) return [];
  return res.data.results.slice(0, 15);
}
