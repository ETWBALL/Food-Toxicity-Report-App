import type { Product, SafetyReport, User, UserAllergy, UserCondition, UserMedication } from '@prisma/client';

function formatAllergy(a: UserAllergy): string {
  const name = a.allergen ?? a.name ?? 'unknown';
  return [name, a.severity ? `severity: ${a.severity}` : null].filter(Boolean).join(' — ');
}

function formatCondition(c: UserCondition): string {
  return c.conditionName ?? c.name ?? 'unknown';
}

function formatMedication(m: UserMedication): string {
  const name = m.medicationName ?? m.name ?? 'unknown';
  return [name, m.dosage, m.frequency].filter(Boolean).join(' | ');
}

function reportSnapshotJson(report: SafetyReport): Record<string, unknown> {
  return {
    id: report.id,
    userId: report.userId,
    productId: report.productId,
    scanId: report.scanId,
    overallScore: report.overallScore,
    allergenScore: report.allergenScore,
    toxicityScore: report.toxicityScore,
    recallScore: report.recallScore,
    drugInteractionScore: report.drugInteractionScore,
    adverseEventScore: report.adverseEventScore,
    knownReactions: report.knownReactions,
    potentialHarms: report.potentialHarms,
    allergenFlags: report.allergenFlags,
    drugFlags: report.drugFlags,
    toxicityFlags: report.toxicityFlags,
    severityLevel: report.severityLevel,
    isPersonalized: report.isPersonalized,
    fdaReportCount: report.fdaReportCount,
    fdaReactionSummary: report.fdaReactionSummary,
    nutritionalScore: report.nutritionalScore,
    calories: report.calories,
    sugarLevel: report.sugarLevel,
    sodiumLevel: report.sodiumLevel,
    saturatedFatLevel: report.saturatedFatLevel,
    proteinLevel: report.proteinLevel,
    fiberLevel: report.fiberLevel,
    nutritionalFlags: report.nutritionalFlags,
    nutritionalSummary: report.nutritionalSummary,
    dailyValueWarnings: report.dailyValueWarnings,
    conditionFlags: report.conditionFlags,
    reportDate: report.reportDate,
  };
}

function productSnapshot(product: Product | null): Record<string, unknown> | null {
  if (!product) return null;
  return {
    name: product.name,
    brand: product.brand,
    type: product.type,
    barcodeNumber: product.barcodeNumber,
    ingredientList: product.ingredientList,
    description: product.description,
    manufacturer: product.manufacturer,
    nutritionalInfo: product.nutritionalInfo,
  };
}

export function buildSafetyAnalysisUserPrompt(input: {
  user: User;
  allergies: UserAllergy[];
  conditions: UserCondition[];
  medications: UserMedication[];
  report: SafetyReport;
  product: Product | null;
}): string {
  const { user, allergies, conditions, medications, report, product } = input;

  const healthBlock = [
    `Profile: name=${user.name}, country=${user.country ?? 'unknown'}, age=${user.age ?? 'unknown'}`,
    '',
    'ALLERGIES (review every ingredient against these):',
    allergies.length
      ? allergies.map((a) => `- ${formatAllergy(a)}`).join('\n')
      : '- none recorded',
    '',
    'CONDITIONS:',
    conditions.length
      ? conditions.map((c) => `- ${formatCondition(c)}`).join('\n')
      : '- none recorded',
    '',
    'MEDICATIONS (check interactions with product type / ingredients / label):',
    medications.length
      ? medications.map((m) => `- ${formatMedication(m)}`).join('\n')
      : '- none recorded',
  ].join('\n');

  const reportBlock = JSON.stringify(
    {
      currentSafetyReport: reportSnapshotJson(report),
      product: productSnapshot(product),
    },
    null,
    2,
  );

  return [
    'TASK: Re-evaluate this safety report for THIS USER ONLY. Adjust scores and narrative fields to reflect their allergies, conditions, and medications.',
    '',
    healthBlock,
    '',
    'DATA (existing pipeline output — you may refine scores and text):',
    reportBlock,
    '',
    'Respond only with the fenced JSON described in the system message.',
  ].join('\n');
}
