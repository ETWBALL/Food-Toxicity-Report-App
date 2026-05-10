import { fetchJson } from '@/lib/integrations/fetch';

export type OffParsed = {
  name: string | null;
  brand: string | null;
  categories: string | null;
  ingredientsText: string | null;
  imageUrl: string | null;
  nutrimentsJson: string | null;
  rawCategoriesTags: string[];
};

type OffV2Response = {
  status?: number;
  product?: {
    product_name?: string;
    brands?: string;
    categories?: string;
    categories_tags?: string[];
    ingredients_text?: string;
    image_url?: string;
    nutriments?: Record<string, unknown>;
  };
};

export async function lookupOpenFoodFacts(barcode: string): Promise<OffParsed | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetchJson<OffV2Response>(url, {
    timeoutMs: 12_000,
    headers: { 'User-Agent': 'FoodToxicityReportApp/1.0 (contact@localhost)' },
  });

  if (!res.ok || res.data.status !== 1 || !res.data.product) return null;

  const p = res.data.product;
  const nutrimentsJson =
    p.nutriments != null ? JSON.stringify(p.nutriments) : null;

  return {
    name: p.product_name ?? null,
    brand: p.brands ?? null,
    categories: p.categories ?? null,
    ingredientsText: p.ingredients_text ?? null,
    imageUrl: p.image_url ?? null,
    nutrimentsJson,
    rawCategoriesTags: p.categories_tags ?? [],
  };
}
