const OFF_BASE = process.env.OPENFOODFACTS_BASE_URL || 'https://world.openfoodfacts.org/api/v2';
const USER_AGENT = `SafeScan/1.0 (chinwei624@gmail.com)`;
const FIELDS = [
  'product_name',
  'brands',
  'categories_tags',
  'ingredients_text',
  'allergens_tags',
  'nutriments',
  'image_front_url',
  'nutrition_grades',
].join(',');

export type OffProduct = {
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  ingredients_text?: string;
  allergens_tags?: string[];
  nutriments?: Record<string, unknown>;
  image_front_url?: string;
  nutrition_grades?: string;
};

type OffResponse =
  | { status: 1; product: OffProduct }
  | { status: 0; status_verbose: string };

async function fetchWithBackoff(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status !== 503) return res;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300 * 2 ** i));
  }
  throw new Error(`OpenFoodFacts unreachable: ${String(lastErr ?? 'repeated 503')}`);
}

export async function fetchProductByBarcode(barcode: string): Promise<OffProduct | null> {
  const url = `${OFF_BASE}/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const res = await fetchWithBackoff(url);
  if (!res.ok) return null;
  const json = (await res.json()) as OffResponse;
  if (json.status === 0) return null;
  return json.product ?? null;
}

export type ProductRowInsert = {
  barcode: string;
  name: string | null;
  brand: string | null;
  type: string | null;
  ingredients: string | null;
  nutritional_info: string | null;
  image_url: string | null;
};

export function mapOffToProductRow(barcode: string, off: OffProduct): ProductRowInsert {
  return {
    barcode,
    name: off.product_name?.trim() || null,
    brand: off.brands?.trim() || null,
    type: off.categories_tags?.[0]?.replace(/^en:/, '') || null,
    ingredients: off.ingredients_text?.trim() || null,
    nutritional_info: off.nutriments ? JSON.stringify(off.nutriments) : null,
    image_url: off.image_front_url || null,
  };
}
