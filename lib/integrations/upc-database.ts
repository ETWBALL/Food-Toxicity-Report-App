import { fetchJson } from '@/lib/integrations/fetch';

/**
 * UPC Database (upcdatabase.org) — path-style lookup.
 * @see https://upcdatabase.org/api — pattern `https://api.upcdatabase.org/product/{API_KEY}/{UPC}`
 */
export type UpcDatabaseProduct = {
  title?: string;
  brand?: string;
  description?: string;
  category?: string;
  ingredients?: string;
  images?: string[];
  image?: string;
};

type UpcResponse = UpcDatabaseProduct & {
  success?: boolean;
  error?: string;
};

export async function lookupUpcDatabase(barcode: string): Promise<UpcDatabaseProduct | null> {
  const key = process.env.UPC_API_KEY;
  if (!key) return null;

  const url = `https://api.upcdatabase.org/product/${encodeURIComponent(key)}/${encodeURIComponent(barcode)}`;
  const res = await fetchJson<UpcResponse>(url, { timeoutMs: 12_000 });

  if (!res.ok || res.data.error || res.data.success === false) return null;
  if (!res.data.title && !res.data.description) return null;

  return {
    title: res.data.title,
    brand: res.data.brand,
    description: res.data.description,
    category: res.data.category,
    ingredients: res.data.ingredients,
    images: res.data.images,
    image: res.data.image,
  };
}
