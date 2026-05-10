import type { SafetyReport } from '@prisma/client';

/** Canonical section keys → Prisma field names on SafetyReport */
export const SAFETY_REPORT_SECTIONS: Record<string, (keyof SafetyReport)[]> = {
  meta: [
    'id',
    'scanId',
    'userId',
    'productId',
    'overallScore',
    'reportDate',
    'createdAt',
    'updatedAt',
  ],
  /** Score breakdown (individual dimensions) */
  scores: [
    'allergenScore',
    'toxicityScore',
    'recallScore',
    'drugInteractionScore',
    'adverseEventScore',
  ],
  reactions: ['knownReactions', 'potentialHarms'],
  flags: ['allergenFlags', 'drugFlags', 'toxicityFlags'],
  outcomes: ['severityLevel', 'isPersonalized'],
  fda: ['fdaReportCount', 'fdaReactionSummary'],
  nutritional: [
    'nutritionalScore',
    'calories',
    'sugarLevel',
    'sodiumLevel',
    'saturatedFatLevel',
    'proteinLevel',
    'fiberLevel',
    'nutritionalFlags',
    'nutritionalSummary',
    'dailyValueWarnings',
  ],
  personalization: ['conditionFlags', 'aiAnalysisSummary'],
};

/** Maps alternate query tokens → canonical section key */
const SECTION_ALIASES: Record<string, keyof typeof SAFETY_REPORT_SECTIONS> = {
  header: 'meta',
  scoresbreakdown: 'scores',
  breakdown: 'scores',
  reactionsymptoms: 'reactions',
  warnings: 'flags',
  fdaadverse: 'fda',
  adverse: 'fda',
  nutrition: 'nutritional',
  macros: 'nutritional',
  conditions: 'personalization',
  personalized: 'personalization',
};

const ALLOWED_SECTIONS = new Set(Object.keys(SAFETY_REPORT_SECTIONS));

export function normalizeSectionToken(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  const mapped = SECTION_ALIASES[t];
  if (mapped) return mapped;
  if (ALLOWED_SECTIONS.has(t)) return t;
  return null;
}

export type ParsedReportFields =
  | { mode: 'full' }
  | { mode: 'partial'; sections: string[] }
  | { mode: 'invalid'; invalid: string[]; allowed: string[] };

/**
 * `fields` query: comma-separated section names.
 * Omit `fields` or leave empty → full report (all Prisma fields).
 */
export function parseReportFieldsQuery(fieldsParam: string | null): ParsedReportFields {
  if (fieldsParam == null || fieldsParam.trim() === '') {
    return { mode: 'full' };
  }

  const parts = fieldsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { mode: 'full' };
  }

  const sections: string[] = [];
  const invalid: string[] = [];

  for (const p of parts) {
    const canon = normalizeSectionToken(p);
    if (canon) {
      if (!sections.includes(canon)) {
        sections.push(canon);
      }
    } else {
      invalid.push(p);
    }
  }

  if (invalid.length > 0) {
    return { mode: 'invalid', invalid, allowed: Array.from(ALLOWED_SECTIONS) };
  }

  return { mode: 'partial', sections };
}

export function listAllowedReportSections(): string[] {
  return Array.from(ALLOWED_SECTIONS).sort();
}

function pickSection(report: SafetyReport, section: string): Record<string, unknown> {
  const keys = SAFETY_REPORT_SECTIONS[section];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (section === 'meta' && k === 'id') {
      continue;
    }
    out[k as string] = report[k];
  }
  return out;
}

/** Full document as a plain object suitable for JSON (all scalar fields). */
export function fullSafetyReportJson(report: SafetyReport): Record<string, unknown> {
  return { ...report };
}

/** Nested sections when `fields` is used; always includes top-level `id`. */
export function partialSafetyReportJson(report: SafetyReport, sections: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { id: report.id };
  for (const section of sections) {
    out[section] = pickSection(report, section);
  }
  return out;
}

export function buildSafetyReportResponse(
  report: SafetyReport,
  parsed: ParsedReportFields,
): Record<string, unknown> {
  if (parsed.mode === 'invalid') {
    return {
      error: 'Invalid fields sections',
      invalid: parsed.invalid,
      allowedSections: parsed.allowed.sort(),
    };
  }

  if (parsed.mode === 'full') {
    return fullSafetyReportJson(report);
  }

  return partialSafetyReportJson(report, parsed.sections);
}
