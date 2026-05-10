/**
 * Placeholder prompts for a future LLM provider. Content is intentionally static
 * so the POST /api/reports pipeline can record what *would* be sent without calling an LLM yet.
 */

export function buildFoodAnalysisPrompt(input: {
  productName: string;
  brand: string | null;
  ingredients: string | null;
  userAllergies: string[];
  userConditions: string[];
  userMedications: string[];
  recallSummaries: string[];
  adverseSummaries: string[];
  newsHeadlines: string[];
}): string {
  return [
    'SYSTEM: You are a clinical nutrition assistant. Be cautious and cite uncertainty.',
    '',
    `PRODUCT: ${input.brand ?? 'Unknown brand'} — ${input.productName}`,
    `INGREDIENTS (may be incomplete): ${input.ingredients ?? 'n/a'}`,
    '',
    `USER ALLERGIES: ${input.userAllergies.join(', ') || 'none declared'}`,
    `USER CONDITIONS: ${input.userConditions.join(', ') || 'none declared'}`,
    `USER MEDICATIONS: ${input.userMedications.join(', ') || 'none declared'}`,
    '',
    `FDA RECALL SIGNALS (summarized): ${input.recallSummaries.join(' | ') || 'none returned'}`,
    `FDA ADVERSE EVENT SIGNALS (summarized): ${input.adverseSummaries.join(' | ') || 'none returned'}`,
    `RECENT NEWS (titles only): ${input.newsHeadlines.join(' | ') || 'none returned'}`,
    '',
    'TASK: Produce (1) personalized risk bullets, (2) notable ingredient conflicts with allergies/meds, (3) remaining caveats about missing data.',
  ].join('\n');
}

export function buildSupplementToxicityPrompt(input: {
  productName: string;
  brand: string | null;
  ingredients: string | null;
  newsHeadlines: string[];
}): string {
  return [
    'SYSTEM: Assess supplement hazard signals using only provided text (no hallucinated lab values).',
    '',
    `SUPPLEMENT: ${input.brand ?? ''} ${input.productName}`,
    `LABEL TEXT / INGREDIENTS: ${input.ingredients ?? 'unknown'}`,
    `HEADLINES: ${input.newsHeadlines.join(' | ') || 'none'}`,
    '',
    'TASK: Flag heavy-metal / contamination patterns if mentioned; otherwise state data gaps.',
  ].join('\n');
}

export function buildDrugCountryPrompt(input: {
  productName: string;
  brand: string | null;
  country: string | null;
  labelWarnings: string | null;
}): string {
  return [
    'SYSTEM: Summarize regulatory/labelling considerations; do not claim legal approval status without sources.',
    '',
    `DRUG BRAND: ${input.brand ?? ''} ${input.productName}`,
    `USER COUNTRY: ${input.country ?? 'unknown'}`,
    `FDA LABEL WARNINGS (excerpt): ${input.labelWarnings ?? 'n/a'}`,
    '',
    'TASK: Provide patient-facing cautions and questions for a pharmacist/clinician.',
  ].join('\n');
}
