import { fetchJson, openfdaKeyQuery } from '@/lib/integrations/fetch';

export type DrugLabelSummary = {
  brandNames?: string[];
  warnings?: string[];
  interactions?: string[];
  rawSections?: string;
};

type LabelResponse = {
  results?: Array<{
    openfda?: {
      brand_name?: string[];
      generic_name?: string[];
    };
    warnings_and_cautions?: string[];
    drug_interactions?: string[];
  }>;
};

export async function fetchDrugLabelByBrand(brandName: string): Promise<DrugLabelSummary | null> {
  const term = brandName.trim().slice(0, 80);
  if (!term) return null;

  const search = `openfda.brand_name:"${term.replace(/"/g, '')}"`;
  const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(search)}&limit=1${openfdaKeyQuery()}`;
  const res = await fetchJson<LabelResponse>(url, { timeoutMs: 12_000 });
  if (!res.ok || !res.data.results?.length) return null;

  const row = res.data.results[0];
  const warnings = row.warnings_and_cautions ?? [];
  const interactions = row.drug_interactions ?? [];
  const brandNames = row.openfda?.brand_name ?? [];

  return {
    brandNames,
    warnings,
    interactions,
    rawSections: [...warnings, ...interactions].join('\n').slice(0, 8000),
  };
}
