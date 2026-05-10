import type { Prisma, UserAllergy } from '@prisma/client';

/**
 * Defensive failsafe applied AFTER the AI has produced its scores.
 *
 * Live test discovered that scanning peanut butter (ingredient list literally
 * "Dry roasted peanuts. Contains: Peanuts.") for a peanut-allergic user
 * produced overallScore=97 / allergenScore=100 / verdict "Safe · mild" — the
 * AI cleared the allergen flag entirely. That is a potentially life-
 * threatening false negative.
 *
 * This guard is deterministic and overrides the AI: if any user-listed
 * allergen literally appears (case-insensitive substring) in the product's
 * ingredient list, force:
 *   - allergenScore ≤ 20
 *   - overallScore  ≤ 25
 *   - severityLevel "critical" (unless AI returned something already strict)
 *   - allergenFlags includes the matched allergens
 *
 * Synonyms (peanut↔groundnut, etc.) are intentionally NOT folded in here.
 * The synonym matching is left to the AI/system-prompt layer; this guard
 * fires only on direct literal matches, which are unambiguously dangerous.
 */
export function applyAllergenSafetyGuard(
  updateData: Prisma.SafetyReportUpdateInput,
  allergies: UserAllergy[],
  ingredientList: string | null,
): Prisma.SafetyReportUpdateInput {
  if (!ingredientList || allergies.length === 0) return updateData;

  const ing = ingredientList.toLowerCase();
  const hits: string[] = [];
  for (const a of allergies) {
    const term = (a.allergen ?? '').toLowerCase().trim();
    if (term.length > 1 && ing.includes(term) && a.allergen) {
      hits.push(a.allergen);
    }
  }
  if (hits.length === 0) return updateData;

  const flagText = hits.join(', ');
  const existingFlags =
    typeof updateData.allergenFlags === 'string' ? updateData.allergenFlags : '';
  const mergedFlags =
    existingFlags && existingFlags.toLowerCase().includes(hits[0].toLowerCase())
      ? existingFlags
      : flagText;

  const currentAllergen =
    typeof updateData.allergenScore === 'number' ? updateData.allergenScore : 100;
  const currentOverall =
    typeof updateData.overallScore === 'number' ? updateData.overallScore : 100;

  return {
    ...updateData,
    allergenScore: Math.min(currentAllergen, 20),
    overallScore: Math.min(currentOverall, 25),
    score: Math.min(typeof updateData.score === 'number' ? updateData.score : 100, 25),
    severityLevel: 'critical',
    allergenFlags: mergedFlags,
  };
}
