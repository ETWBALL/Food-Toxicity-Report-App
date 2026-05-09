type ScanContext = {
  productName: string | null;
  score: number;
  verdict: 'Safe' | 'Caution' | 'Unsafe';
  recallActive: boolean;
  recallSeverity?: string | null;
  allergyFlags: string[];
  drugFlags: Array<{ medication: string; interaction: string }>;
};

function deterministicSummary(ctx: ScanContext): string {
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

export async function generateScanSummary(ctx: ScanContext, baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/analysis/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'scan_summary', context: ctx }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return deterministicSummary(ctx);
    const json = (await res.json()) as { summary?: string };
    return json.summary?.trim() || deterministicSummary(ctx);
  } catch {
    return deterministicSummary(ctx);
  }
}

export { deterministicSummary };
