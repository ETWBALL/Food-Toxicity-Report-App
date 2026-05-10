import { createHash } from 'crypto';
import type {
  SafetyReport,
  ScanHistory,
  UserAllergy,
  UserCondition,
  UserMedication,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nutritionApiNinjas } from '@/lib/integrations/api-ninjas-nutrition';
import { analyzeIngredientsEdamam } from '@/lib/integrations/edamam';
import { searchDailyMedSpl } from '@/lib/integrations/dailymed';
import { fetchDrugLabelByBrand } from '@/lib/integrations/fda-drug-label';
import { fetchLatestNews } from '@/lib/integrations/news';
import { lookupOpenFoodFacts } from '@/lib/integrations/openfoodfacts';
import {
  fetchDrugAdverseEvents,
  fetchDrugRecalls,
  fetchFoodAdverseEvents,
  fetchFoodRecalls,
  type OpenfdaAdverseRow,
  type OpenfdaFoodEventRow,
  type OpenfdaRecallRow,
} from '@/lib/integrations/openfda';
import { lookupRapidBarcode } from '@/lib/integrations/rapid-barcode';
import { rxnormApproximateCandidates } from '@/lib/integrations/rxnorm';
import { lookupUpcDatabase } from '@/lib/integrations/upc-database';
import {
  buildDrugCountryPrompt,
  buildFoodAnalysisPrompt,
  buildSupplementToxicityPrompt,
} from '@/lib/reports/prompt-templates';

export type ReportOrchestrationInput =
  | { userId: number; scanId?: number; barcode: string }
  | { userId: number; scanId?: number; productName: string };

export type OrchestrationMeta = {
  trace: string[];
  newsCount: number;
  foodRecalls: number;
  drugRecalls: number;
  /** FAERS drug adverse */
  drugAdverseEvents: number;
  /** openFDA food/event (CAERS) */
  foodAdverseEvents: number;
  /** @deprecated use drugAdverseEvents + foodAdverseEvents */
  adverseEvents: number;
  productSources: string[];
  prompts: { primary?: string };
};

type UserProfile = {
  allergies: UserAllergy[];
  conditions: UserCondition[];
  medications: UserMedication[];
  country: string | null;
};

function pickNonEmpty(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function inferProductType(categoriesBlob: string | null, offTags: string[], nameHint: string): 'food' | 'supplement' | 'Drugs' {
  const blob = `${categoriesBlob ?? ''} ${offTags.join(' ')} ${nameHint}`.toLowerCase();
  if (/\b(supplement|vitamin|botanical|herbal|probiotic)\b/.test(blob)) return 'supplement';
  if (/\b(drug|prescription|rx|tablet|mg capsule|inhaler)\b/.test(blob)) return 'Drugs';
  return 'food';
}

function normalizeBarcode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : raw.trim();
}

function stableNameKey(productName: string): string {
  const h = createHash('sha256').update(productName.trim().toLowerCase()).digest('hex').slice(0, 28);
  return `nm:${h}`;
}

function scoreAllergens(ingredients: string | null, allergies: UserAllergy[]): number {
  if (!ingredients || allergies.length === 0) return 100;
  let score = 100;
  const ing = ingredients.toLowerCase();
  for (const a of allergies) {
    const term = a.allergen.toLowerCase();
    if (term.length > 1 && ing.includes(term)) {
      const sev = (a.severity ?? '').toLowerCase();
      if (sev.includes('severe')) score -= 45;
      else if (sev.includes('moderate')) score -= 28;
      else score -= 15;
    }
  }
  return clamp(score);
}

function scoreRecalls(rows: OpenfdaRecallRow[]): number {
  if (!rows.length) return 100;
  let penalty = 6 * rows.length;
  for (const r of rows) {
    const c = (r.classification ?? '').toLowerCase();
    if (c.includes('class i')) penalty += 22;
    else if (c.includes('class ii')) penalty += 14;
    else penalty += 6;
  }
  return clamp(100 - penalty);
}

function scoreAdverse(count: number): number {
  if (!count) return 100;
  return clamp(100 - Math.min(75, 4 * count));
}

function scoreDrugInteractions(labelText: string | null, meds: UserMedication[]): number {
  if (!meds.length || !labelText) return 95;
  let hits = 0;
  const lower = labelText.toLowerCase();
  for (const m of meds) {
    const t = m.medicationName.trim().toLowerCase();
    if (t.length > 3 && lower.includes(t)) hits++;
  }
  return clamp(100 - hits * 20);
}

function scoreToxicityKeyword(ingredients: string | null, newsTitles: string[]): number {
  let s = 90;
  const blob = `${ingredients ?? ''} ${newsTitles.join(' ')}`.toLowerCase();
  if (/\b(lead|arsenic|cadmium|mercury|heavy metal|contamination)\b/.test(blob)) s -= 38;
  return clamp(s);
}

function summarizeRecalls(rows: OpenfdaRecallRow[]): string[] {
  return rows.slice(0, 5).map((r) => {
    const date = r.report_date || r.recall_initiation_date || '?';
    return `[${date}] ${r.product_description ?? 'product'} — ${r.reason_for_recall ?? 'reason not stated'}`;
  });
}

function summarizeDrugAdverse(rows: OpenfdaAdverseRow[]): string {
  return `${rows.length} recent FAERS reports (brand/name match — verify clinically).`;
}

function summarizeFoodAdverse(rows: OpenfdaFoodEventRow[]): string {
  return `${rows.length} recent food/supplement adverse reports (openFDA food/event — verify clinically).`;
}

function sugarBand(g?: number): string | null {
  if (g == null || Number.isNaN(g)) return null;
  if (g >= 18) return 'high';
  if (g >= 8) return 'moderate';
  return 'low';
}

function sodiumBand(mg?: number): string | null {
  if (mg == null || Number.isNaN(mg)) return null;
  if (mg >= 600) return 'high';
  if (mg >= 300) return 'moderate';
  return 'low';
}

function nutritionSignalsWeak(
  ninjas: Awaited<ReturnType<typeof nutritionApiNinjas>>,
  edamam: Awaited<ReturnType<typeof analyzeIngredientsEdamam>>,
): boolean {
  const hasN =
    !!ninjas?.length &&
    ninjas.some(
      (n) =>
        (n.sugar_g != null && n.sugar_g > 0) ||
        (n.sodium_mg != null && n.sodium_mg > 0) ||
        (n.serving_size_g != null && n.serving_size_g > 0) ||
        (n.fiber_g != null && n.fiber_g > 0) ||
        (n.name != null && n.name.length > 0),
    );
  const hasE = !!(edamam?.healthLabels?.length || edamam?.dietLabels?.length || edamam?.calories != null);
  return !hasN && !hasE;
}

export async function orchestrateSafetyReport(
  input: ReportOrchestrationInput,
): Promise<{ report: SafetyReport; meta: OrchestrationMeta }> {
  const trace: string[] = [];
  const isBarcode = 'barcode' in input;
  const barcode = isBarcode ? normalizeBarcode(input.barcode) : null;
  const productNameOnly = !isBarcode ? input.productName.trim() : null;
  const productLookupKey = isBarcode ? barcode! : stableNameKey(productNameOnly!);

  const user = await prisma.user.findUnique({
    where: { id: input.userId, deletedAt: null },
    include: { allergies: true, conditions: true, medications: true },
  });
  if (!user) {
    throw new Error('User not found');
  }

  const profile: UserProfile = {
    allergies: user.allergies,
    conditions: user.conditions,
    medications: user.medications,
    country: user.country ?? null,
  };

  if (input.scanId != null) {
    const owned = await prisma.scanHistory.findFirst({
      where: { id: input.scanId, userId: input.userId },
    });
    if (!owned) {
      throw new Error('Invalid scanId for this user');
    }
  }

  const newsSeed = isBarcode ? `${barcode} (FDA OR recall OR safety)` : `${productNameOnly} recall FDA safety`;
  const newsPass1 = await fetchLatestNews(newsSeed);
  trace.push(`news:pass1:${newsPass1.length}`);

  const cacheDays = Number(process.env.PRODUCT_CACHE_TTL_DAYS ?? '30');
  const cacheMs = cacheDays * 86_400_000;

  const existingProduct = await prisma.product.findUnique({
    where: { barcodeNumber: productLookupKey },
  });

  const cacheFresh =
    isBarcode &&
    !!existingProduct?.lastExternalResolutionAt &&
    Date.now() - existingProduct.lastExternalResolutionAt.getTime() < cacheMs;

  let upcTitle: string | null = null;
  let upcBrand: string | null = null;
  let upcIngredients: string | null = null;
  let upcDescription: string | null = null;
  let upcImage: string | null = null;

  let rapidTitle: string | null = null;
  let rapidBrand: string | null = null;
  let rapidManufacturer: string | null = null;
  let rapidIngredients: string | null = null;
  let rapidImage: string | null = null;

  let off: Awaited<ReturnType<typeof lookupOpenFoodFacts>> = null;

  if (isBarcode) {
    if (!cacheFresh) {
      const upc = await lookupUpcDatabase(barcode!);
      if (upc) {
        upcTitle = upc.title ?? null;
        upcBrand = upc.brand ?? null;
        upcIngredients = upc.ingredients ?? null;
        upcDescription = upc.description ?? upc.category ?? null;
        upcImage = upc.image ?? upc.images?.[0] ?? null;
        trace.push('upc-database:hit');
      } else {
        trace.push('upc-database:miss');
        const rapid = await lookupRapidBarcode(barcode!);
        if (rapid) {
          rapidTitle = rapid.title ?? rapid.name ?? null;
          rapidBrand = rapid.brand ?? null;
          rapidManufacturer = rapid.manufacturer ?? null;
          rapidIngredients = rapid.ingredients ?? null;
          rapidImage = rapid.image ?? rapid.images?.[0] ?? null;
          trace.push('rapid-barcode:hit');
        } else trace.push('rapid-barcode:miss');
      }

      off = await lookupOpenFoodFacts(barcode!);
      if (off) trace.push('openfoodfacts:hit');
      else trace.push('openfoodfacts:miss');
    } else {
      trace.push('product-cache:fresh');
      off = await lookupOpenFoodFacts(barcode!);
      if (off) trace.push('openfoodfacts:refresh-sidecar');
    }
  } else {
    trace.push('input:productName-only');
  }

  const name = isBarcode
    ? (pickNonEmpty(
        upcTitle,
        rapidTitle,
        off?.name,
        existingProduct?.name,
        `Product ${barcode}`,
      ) as string)
    : (pickNonEmpty(existingProduct?.name, productNameOnly, 'Unknown product') as string);

  const brand = isBarcode
    ? pickNonEmpty(upcBrand, rapidBrand, existingProduct?.brand, off?.brand, null)
    : pickNonEmpty(existingProduct?.brand, null);

  const manufacturer = isBarcode ? pickNonEmpty(rapidManufacturer, existingProduct?.manufacturer, null) : null;

  const primaryIngredients = isBarcode
    ? pickNonEmpty(off?.ingredientsText, upcIngredients, existingProduct?.ingredientList, null)
    : pickNonEmpty(existingProduct?.ingredientList, null);

  let secondaryIngredients = isBarcode ? pickNonEmpty(rapidIngredients, null) : null;

  let ingredientList = primaryIngredients;

  const categories = isBarcode
    ? pickNonEmpty(off?.categories, upcDescription, existingProduct?.description, null)
    : pickNonEmpty(existingProduct?.description, null);

  const productType = inferProductType(categories, off?.rawCategoriesTags ?? [], name);

  const newsQ2 = `${brand ?? ''} ${name} (FDA OR recall)`.trim();
  const newsPass2 = newsQ2.length > 3 ? await fetchLatestNews(newsQ2) : [];
  trace.push(`news:pass2:${newsPass2.length}`);

  const newsMerged = [...newsPass1, ...newsPass2];
  const newsDedup = Array.from(new Map(newsMerged.map((a) => [a.url, a])).values());

  let foodRecalls: OpenfdaRecallRow[] = [];
  let drugRecalls: OpenfdaRecallRow[] = [];
  let drugAdverse: OpenfdaAdverseRow[] = [];
  let foodAdverse: OpenfdaFoodEventRow[] = [];

  const fdaToken = (pickNonEmpty(name, brand, isBarcode ? barcode : null) ?? name).split(/\s+/)[0] ?? name;

  if (productType === 'food' || productType === 'supplement') {
    foodRecalls = await fetchFoodRecalls(fdaToken);
    trace.push(`fda:food-enforcement:${foodRecalls.length}`);
    foodAdverse = await fetchFoodAdverseEvents(fdaToken);
    trace.push(`fda:food-event:${foodAdverse.length}`);
  }

  if (productType === 'Drugs' || productType === 'supplement') {
    drugRecalls = await fetchDrugRecalls(fdaToken);
    drugAdverse = await fetchDrugAdverseEvents(fdaToken);
    trace.push(`fda:drug-enforcement:${drugRecalls.length}`);
    trace.push(`fda:drug-event:${drugAdverse.length}`);
  }

  let drugLabel = null as Awaited<ReturnType<typeof fetchDrugLabelByBrand>>;
  let dailyMedHit = null as Awaited<ReturnType<typeof searchDailyMedSpl>>;
  if (productType === 'Drugs') {
    drugLabel = await fetchDrugLabelByBrand(brand ?? name);
    trace.push(drugLabel ? 'fda:label:hit' : 'fda:label:miss');
    dailyMedHit = await searchDailyMedSpl(name);
    trace.push(dailyMedHit ? 'dailymed:hit' : 'dailymed:miss');
  }

  const rxLines: string[] = [];
  for (const m of profile.medications.slice(0, 8)) {
    const cands = await rxnormApproximateCandidates(m.medicationName);
    if (cands.length) {
      rxLines.push(`${m.medicationName} → RxNorm: ${cands.map((c) => c.name ?? c.rxcui).join('; ')}`);
    }
  }
  if (rxLines.length) trace.push('rxnorm:user-meds');

  let nutritionalExtra = '';
  let edamam = null as Awaited<ReturnType<typeof analyzeIngredientsEdamam>>;
  let ninjas = await nutritionApiNinjas(`${brand ?? ''} ${name}`.trim());
  if (ninjas?.length) trace.push(`api-ninjas:primary:${ninjas.length}`);

  if (primaryIngredients) {
    edamam = await analyzeIngredientsEdamam(primaryIngredients);
    if (edamam) trace.push('edamam:primary:hit');
  }

  if (isBarcode && nutritionSignalsWeak(ninjas, edamam) && !secondaryIngredients) {
    const rapidOnly = await lookupRapidBarcode(barcode!);
    if (rapidOnly?.ingredients?.trim()) {
      secondaryIngredients = rapidOnly.ingredients.trim();
      trace.push('rapid-barcode:late-fetch-for-nutrition');
    }
  }

  if (
    nutritionSignalsWeak(ninjas, edamam) &&
    secondaryIngredients &&
    secondaryIngredients.trim() !== (primaryIngredients ?? '').trim()
  ) {
    trace.push('nutrition:fallback-rapid-ingredients');
    edamam = await analyzeIngredientsEdamam(secondaryIngredients);
    if (edamam) trace.push('edamam:fallback:hit');
    ninjas = await nutritionApiNinjas(secondaryIngredients.slice(0, 400));
    if (ninjas?.length) trace.push(`api-ninjas:fallback:${ninjas.length}`);
  }

  if (nutritionSignalsWeak(ninjas, edamam) && productType === 'Drugs' && dailyMedHit?.title) {
    trace.push('dailymed:nutrition-fallback');
    nutritionalExtra += `DailyMed: ${dailyMedHit.title}\n`;
    if (!ingredientList) {
      ingredientList = dailyMedHit.title.slice(0, 2000);
    }
  }

  if (edamam) {
    nutritionalExtra += `Edamam: calories=${edamam.calories ?? 'n/a'}; labels=${(edamam.healthLabels ?? []).slice(0, 6).join(', ')}\n`;
  }
  if (ninjas?.length) {
    nutritionalExtra += `API Ninjas: ${JSON.stringify(ninjas[0]).slice(0, 400)}\n`;
  }

  const nutritionalInfo = pickNonEmpty(
    off?.nutrimentsJson,
    existingProduct?.nutritionalInfo,
    nutritionalExtra.trim() || null,
    null,
  );

  const imageUrl = isBarcode ? pickNonEmpty(off?.imageUrl, upcImage, rapidImage, existingProduct?.imageUrl, null) : existingProduct?.imageUrl ?? null;

  const prismaType =
    productType === 'food' ? 'food' : productType === 'supplement' ? 'supplement' : 'Drugs';

  const productRecord = await prisma.product.upsert({
    where: { barcodeNumber: productLookupKey },
    create: {
      barcodeNumber: productLookupKey,
      name,
      brand,
      manufacturer,
      ingredientList,
      nutritionalInfo,
      imageUrl,
      description: categories,
      type: prismaType,
      lastExternalResolutionAt: new Date(),
      externalResolutionSource: trace.filter((t) => t.includes('hit') || t.includes('fda')).join('|').slice(0, 240),
    },
    update: {
      name,
      brand,
      manufacturer,
      ingredientList,
      nutritionalInfo,
      imageUrl,
      description: categories,
      type: prismaType,
      lastExternalResolutionAt: !isBarcode ? new Date() : cacheFresh ? undefined : new Date(),
      externalResolutionSource: trace.join('|').slice(0, 240),
    },
  });

  if (isBarcode && !cacheFresh) {
    await prisma.product.update({
      where: { id: productRecord.id },
      data: { lastExternalResolutionAt: new Date() },
    });
  }

  const recallScore = scoreRecalls([...foodRecalls, ...drugRecalls]);
  const adverseTotal = drugAdverse.length + foodAdverse.length;
  const adverseEventScore = scoreAdverse(adverseTotal);
  const allergenScore = scoreAllergens(ingredientList, profile.allergies);
  const drugInteractionScore = scoreDrugInteractions(drugLabel?.rawSections ?? null, profile.medications);
  const toxicityScore =
    productType === 'supplement'
      ? scoreToxicityKeyword(ingredientList, newsDedup.map((n) => n.title))
      : productType === 'food'
        ? clamp(92 - (newsDedup.some((n) => /\b(recall|contamination)\b/i.test(n.title)) ? 12 : 0))
        : scoreToxicityKeyword(ingredientList, newsDedup.map((n) => n.title));

  const overallScore = clamp(
    Math.round(
      (recallScore + adverseEventScore + allergenScore + drugInteractionScore + toxicityScore) / 5,
    ),
  );

  const recallSummaries = summarizeRecalls([...foodRecalls, ...drugRecalls]);
  const drugAdverseSummary = summarizeDrugAdverse(drugAdverse);
  const foodAdverseSummary = summarizeFoodAdverse(foodAdverse);

  const allergenFlags =
    allergenScore < 100
      ? profile.allergies
          .filter((a) => ingredientList?.toLowerCase().includes(a.allergen.toLowerCase()))
          .map((a) => a.allergen)
          .join(', ')
      : null;

  const drugFlagsParts: string[] = [];
  if (drugInteractionScore < 90) {
    drugFlagsParts.push(
      'Potential overlap between medication list and FDA label text — Medi-Span-style screening not configured.',
    );
  }
  if (productType === 'Drugs' && profile.country) {
    drugFlagsParts.push(
      `Country context (${profile.country}): verify local approval / labeling with a clinician or regulator database.`,
    );
  }
  if (rxLines.length) {
    drugFlagsParts.push(`RxNorm (user meds): ${rxLines.join(' | ').slice(0, 1500)}`);
  }

  const toxicityFlagsParts: string[] = [];
  if (productType === 'supplement') {
    toxicityFlagsParts.push(
      'EPA CTX / deep toxicology APIs not wired — supplement contamination risk may be understated.',
    );
  }

  const conditionParts: string[] = [];
  for (const c of profile.conditions) {
    const cn = c.conditionName.toLowerCase();
    if (
      (cn.includes('diabetes') || cn.includes('diabetic')) &&
      ninjas?.[0]?.sugar_g != null &&
      ninjas[0].sugar_g > 12
    ) {
      conditionParts.push('High sugar vs diabetes profile — verify portion size.');
    }
  }

  const adverseForPrompt = [
    drugAdverse.length ? drugAdverseSummary : '',
    foodAdverse.length ? foodAdverseSummary : '',
  ].filter(Boolean);

  let primaryPrompt: string | undefined;
  if (productType === 'food') {
    primaryPrompt = buildFoodAnalysisPrompt({
      productName: name,
      brand,
      ingredients: ingredientList,
      userAllergies: profile.allergies.map((a) => a.allergen),
      userConditions: profile.conditions.map((c) => c.conditionName),
      userMedications: profile.medications.map((m) => m.medicationName),
      recallSummaries,
      adverseSummaries: adverseForPrompt,
      newsHeadlines: newsDedup.map((n) => n.title),
    });
  } else if (productType === 'supplement') {
    primaryPrompt = buildSupplementToxicityPrompt({
      productName: name,
      brand,
      ingredients: ingredientList,
      newsHeadlines: newsDedup.map((n) => n.title),
    });
  } else {
    primaryPrompt = buildDrugCountryPrompt({
      productName: name,
      brand,
      country: profile.country,
      labelWarnings: drugLabel?.rawSections ?? null,
    });
  }

  const ninjas0 = ninjas?.[0];
  const nutritionalScore = clamp(
    78 -
      (sugarBand(ninjas0?.sugar_g) === 'high' ? 18 : 0) -
      (sodiumBand(ninjas0?.sodium_mg) === 'high' ? 12 : 0),
  );

  let scanRow: ScanHistory;
  if (input.scanId != null) {
    scanRow = await prisma.scanHistory.update({
      where: { id: input.scanId },
      data: {
        productId: productRecord.id,
        safetyScore: overallScore,
      },
    });
  } else {
    scanRow = await prisma.scanHistory.create({
      data: {
        userId: input.userId,
        productId: productRecord.id,
        safetyScore: overallScore,
      },
    });
  }

  const knownReactionsParts = [drugAdverse.length ? drugAdverseSummary : '', foodAdverse.length ? foodAdverseSummary : '']
    .filter(Boolean)
    .join('\n');

  const report = await prisma.safetyReport.create({
    data: {
      userId: input.userId,
      productId: productRecord.id,
      scanId: scanRow.id,
      overallScore,
      allergenScore,
      toxicityScore,
      recallScore,
      drugInteractionScore,
      adverseEventScore,
      knownReactions: knownReactionsParts ? knownReactionsParts.slice(0, 1500) : null,
      potentialHarms: [
        recallSummaries.slice(0, 3).join('\n'),
        newsDedup[0]?.title ? `News: ${newsDedup[0].title}` : '',
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 4000),
      allergenFlags,
      drugFlags: drugFlagsParts.join(' ') || null,
      toxicityFlags: toxicityFlagsParts.join(' ') || null,
      severityLevel:
        overallScore >= 80 ? 'mild' : overallScore >= 55 ? 'moderate' : overallScore >= 35 ? 'severe' : 'critical',
      isPersonalized: profile.allergies.length + profile.conditions.length + profile.medications.length > 0,
      fdaReportCount: adverseTotal || undefined,
      fdaReactionSummary: [drugAdverseSummary, foodAdverseSummary].filter(Boolean).join('\n').slice(0, 2000) || null,
      nutritionalScore,
      calories: ninjas0?.calories ?? edamam?.calories ?? undefined,
      sugarLevel: sugarBand(ninjas0?.sugar_g) ?? undefined,
      sodiumLevel: sodiumBand(ninjas0?.sodium_mg) ?? undefined,
      saturatedFatLevel:
        ninjas0?.fat_saturated_g != null && ninjas0.fat_saturated_g > 12
          ? 'high'
          : ninjas0?.fat_saturated_g != null && ninjas0.fat_saturated_g > 5
            ? 'moderate'
            : ninjas0?.fat_saturated_g != null
              ? 'low'
              : undefined,
      proteinLevel:
        ninjas0?.protein_g != null ? (ninjas0.protein_g > 20 ? 'high' : ninjas0.protein_g > 8 ? 'moderate' : 'low') : undefined,
      fiberLevel:
        ninjas0?.fiber_g != null ? (ninjas0.fiber_g > 8 ? 'high' : ninjas0.fiber_g > 3 ? 'moderate' : 'low') : undefined,
      nutritionalFlags:
        [
          edamam?.healthLabels?.slice(0, 4).join(', '),
          ninjas0?.name ? `Ninjas: ${ninjas0.name}` : '',
        ]
          .filter(Boolean)
          .join(' | ')
          .slice(0, 1500) || null,
      nutritionalSummary: nutritionalExtra.slice(0, 2000) || null,
      dailyValueWarnings: conditionParts.join(' | ') || null,
      conditionFlags: conditionParts.join(' | ') || null,
      aiAnalysisSummary: [
        `STUB LLM prompt (${productType}) stored server-side; replace with provider response.\n`,
        primaryPrompt.slice(0, 3500),
      ]
        .join('')
        .slice(0, 8000),
    },
  });

  const meta: OrchestrationMeta = {
    trace,
    newsCount: newsDedup.length,
    foodRecalls: foodRecalls.length,
    drugRecalls: drugRecalls.length,
    drugAdverseEvents: drugAdverse.length,
    foodAdverseEvents: foodAdverse.length,
    adverseEvents: adverseTotal,
    productSources: trace.filter((t) => t.endsWith(':hit')),
    prompts: { primary: primaryPrompt },
  };

  return { report, meta };
}
