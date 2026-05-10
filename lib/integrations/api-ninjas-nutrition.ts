import { fetchJson } from '@/lib/integrations/fetch';

export type NinjasNutritionItem = {
  name?: string;
  calories?: number;
  protein_g?: number;
  sodium_mg?: number;
  sugar_g?: number;
  fat_saturated_g?: number;
  fiber_g?: number;
  serving_size_g?: number;
};

/**
 * Natural-language nutrition lookup (API Ninjas).
 */
export async function nutritionApiNinjas(query: string): Promise<NinjasNutritionItem[] | null> {
  const key = process.env.API_NINJAS_KEY;
  if (!key || !query.trim()) return null;

  const url = `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(query.slice(0, 400))}`;
  const res = await fetchJson<NinjasNutritionItem[]>(url, {
    timeoutMs: 12_000,
    headers: { 'X-Api-Key': key },
  });

  if (!res.ok || !Array.isArray(res.data)) return null;
  return res.data.slice(0, 8);
}
