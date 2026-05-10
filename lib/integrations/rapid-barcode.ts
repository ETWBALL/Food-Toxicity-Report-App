import { fetchJson } from '@/lib/integrations/fetch';

/**
 * RapidAPI-hosted barcode product lookup (fallback after UPC Database).
 * Set `RAPID_API_BARCODE_HOST` to your subscribed API host (e.g. barcodes1.p.rapidapi.com).
 * Default path: `/?bin={barcode}` — override with `RAPID_API_BARCODE_PATH` (use `{barcode}` placeholder).
 */
export type RapidBarcodeProduct = {
  title?: string;
  name?: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  description?: string;
  ingredients?: string;
  image?: string;
  images?: string[];
};

function buildRapidBarcodeUrl(barcode: string): string | null {
  const key = process.env.RAPID_API_KEY;
  if (!key) return null;

  const host = process.env.RAPID_API_BARCODE_HOST?.trim() || 'barcodes1.p.rapidapi.com';
  const pathTemplate =
    process.env.RAPID_API_BARCODE_PATH?.trim() || '/?bin={barcode}';
  const path = pathTemplate.includes('{barcode}')
    ? pathTemplate.replace(/\{barcode\}/g, encodeURIComponent(barcode))
    : `${pathTemplate}${encodeURIComponent(barcode)}`;

  return `https://${host}${path.startsWith('/') ? path : `/${path}`}`;
}

function flattenUnknown(data: unknown): RapidBarcodeProduct | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;

  const product =
    o.product && typeof o.product === 'object' ? (o.product as Record<string, unknown>) : o;

  const title = (product.title ?? product.name ?? product.product_name) as string | undefined;
  if (!title && !product.description) return null;

  return {
    title: typeof title === 'string' ? title : undefined,
    name: typeof product.name === 'string' ? product.name : undefined,
    brand: typeof product.brand === 'string' ? product.brand : undefined,
    manufacturer: typeof product.manufacturer === 'string' ? product.manufacturer : undefined,
    category: typeof product.category === 'string' ? product.category : undefined,
    description: typeof product.description === 'string' ? product.description : undefined,
    ingredients: typeof product.ingredients === 'string' ? product.ingredients : undefined,
    image: typeof product.image === 'string' ? product.image : undefined,
    images: Array.isArray(product.images) ? (product.images as string[]) : undefined,
  };
}

export async function lookupRapidBarcode(barcode: string): Promise<RapidBarcodeProduct | null> {
  const url = buildRapidBarcodeUrl(barcode);
  if (!url) return null;

  const host = process.env.RAPID_API_BARCODE_HOST?.trim() || 'barcodes1.p.rapidapi.com';
  const res = await fetchJson<unknown>(url, {
    timeoutMs: 12_000,
    headers: {
      'X-RapidAPI-Key': process.env.RAPID_API_KEY!,
      'X-RapidAPI-Host': host,
    },
  });

  if (!res.ok) return null;
  return flattenUnknown(res.data);
}
