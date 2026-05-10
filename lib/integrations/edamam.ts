import { fetchJson } from '@/lib/integrations/fetch';

export type EdamamNutritionSummary = {
  calories?: number;
  dietLabels?: string[];
  healthLabels?: string[];
  rawUri?: string;
};

/**
 * Ingredient line nutrition analysis (Edamam Nutrition Data API).
 */
export async function analyzeIngredientsEdamam(ingredientLine: string): Promise<EdamamNutritionSummary | null> {
  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;
  if (!appId || !appKey || !ingredientLine.trim()) return null;

  const url = `https://api.edamam.com/api/nutrition-data?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&nutrition-type=cooking&ingr=${encodeURIComponent(ingredientLine.slice(0, 1500))}`;
  const res = await fetchJson<{
    calories?: number;
    dietLabels?: string[];
    healthLabels?: string[];
    uri?: string;
  }>(url, { timeoutMs: 12_000 });

  if (!res.ok) return null;

  return {
    calories: res.data.calories,
    dietLabels: res.data.dietLabels,
    healthLabels: res.data.healthLabels,
    rawUri: res.data.uri,
  };
}
