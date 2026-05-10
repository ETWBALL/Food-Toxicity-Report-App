/**
 * Deterministic templated summary used by POST /api/users/:id/scans.
 *
 * As of PR #7, real AI generation lives at POST /api/analysis/generate
 * (Featherless-backed, requires reportId). The client triggers it after
 * receiving the scan response. This file no longer attempts a network call —
 * the previous implementation fetched /api/analysis/generate with the wrong
 * payload shape ({kind, context} vs the real {reportId} contract) and always
 * fell back to the template anyway.
 */

type ScanContext = {
  productName: string | null;
  score: number;
  verdict: 'Safe' | 'Caution' | 'Unsafe';
  recallActive: boolean;
  recallSeverity?: string | null;
  allergyFlags: string[];
  drugFlags: Array<{ medication: string; interaction: string }>;
};

export function deterministicSummary(ctx: ScanContext): string {
  const parts: string[] = [];
  if (ctx.recallActive) {
    parts.push(`Active ${ctx.recallSeverity ?? 'recall'} on this product.`);
  }
  if (ctx.allergyFlags.length) {
    parts.push(`Contains allergens you flagged: ${ctx.allergyFlags.join(', ')}.`);
  }
  if (ctx.drugFlags.length) {
    parts.push(
      `Possible interaction with your medication${ctx.drugFlags.length > 1 ? 's' : ''}: ${ctx.drugFlags
        .map((f) => f.medication)
        .join(', ')}.`,
    );
  }
  if (!parts.length) parts.push('No safety flags found for your profile.');
  parts.push(`Safety score ${ctx.score}/100 (${ctx.verdict}).`);
  return parts.join(' ');
}

/**
 * Returns a templated summary synchronously. Kept async-shaped for backward
 * compatibility with callers that previously awaited a network roundtrip.
 */
export async function generateScanSummary(ctx: ScanContext, _baseUrl: string): Promise<string> {
  return deterministicSummary(ctx);
}
