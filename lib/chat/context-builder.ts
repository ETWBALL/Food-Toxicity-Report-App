import { prisma } from '@/lib/prisma';

/**
 * Loads everything the chatbot needs to ground its reply: user profile,
 * focus reports (full detail), recent reports (compact list), and memories.
 *
 * Tier 1 = focusReports (passed via URL/body).
 * Tier 2 = recentReports auto-injected so the AI can reference any of the
 *          user's last N scans by product name without an extra fetch.
 *
 * All queries scoped by `userId` — defense in depth against IDOR even if
 * the route handler's auth check is bypassed.
 */
export async function buildChatContext(params: {
  userId: number;
  focusReportIds?: number[];
  recentLimit?: number;
  memoryLimit?: number;
}) {
  const { userId } = params;
  const focusReportIds = params.focusReportIds ?? [];
  const recentLimit = params.recentLimit ?? 30;
  const memoryLimit = params.memoryLimit ?? 20;

  const [user, focusReports, recentReports, memories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { allergies: true, conditions: true, medications: true },
    }),
    focusReportIds.length
      ? prisma.safetyReport.findMany({
          where: { id: { in: focusReportIds }, userId },
          include: { product: true },
          orderBy: { reportDate: 'desc' },
        })
      : Promise.resolve([]),
    prisma.safetyReport.findMany({
      where: { userId, ...(focusReportIds.length ? { id: { notIn: focusReportIds } } : {}) },
      orderBy: { reportDate: 'desc' },
      take: recentLimit,
      select: {
        id: true,
        overallScore: true,
        score: true,
        verdict: true,
        severityLevel: true,
        reportDate: true,
        product: { select: { name: true, barcodeNumber: true } },
      },
    }),
    prisma.userMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: memoryLimit,
    }),
  ]);

  return { user, focusReports, recentReports, memories };
}

export type ChatContext = Awaited<ReturnType<typeof buildChatContext>>;

function joinNonEmpty(values: Array<string | null | undefined>, sep = ', '): string {
  return values
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0)
    .join(sep);
}

/** Renders the loaded context as a single prompt-prefix string. */
export function formatContextAsPromptPrefix(ctx: ChatContext): string {
  const parts: string[] = [];

  // --- User profile ---
  if (ctx.user) {
    parts.push('# User Profile');
    parts.push(`- Name: ${ctx.user.name}`);
    if (ctx.user.country) parts.push(`- Country: ${ctx.user.country}`);
    if (ctx.user.age != null) parts.push(`- Age: ${ctx.user.age}`);

    const allergens = joinNonEmpty(ctx.user.allergies.map((a) => a.allergen ?? a.name));
    if (allergens) parts.push(`- Known allergies: ${allergens}`);

    const conditions = joinNonEmpty(ctx.user.conditions.map((c) => c.conditionName ?? c.name));
    if (conditions) parts.push(`- Conditions: ${conditions}`);

    const meds = joinNonEmpty(ctx.user.medications.map((m) => m.medicationName ?? m.name));
    if (meds) parts.push(`- Medications: ${meds}`);
  }

  // --- Focus reports (full detail) ---
  if (ctx.focusReports.length) {
    parts.push('\n# Reports in focus (the user is currently looking at these)');
    for (const r of ctx.focusReports) {
      const name = r.product?.name ?? 'Unknown product';
      const score = r.overallScore ?? r.score ?? '—';
      parts.push(`\n## ${name} (report id ${r.id})`);
      parts.push(`- Score: ${score}/100`);
      if (r.verdict) parts.push(`- Verdict: ${r.verdict}`);
      if (r.severityLevel) parts.push(`- Severity: ${r.severityLevel}`);
      if (r.allergenFlags) parts.push(`- Allergen flags: ${r.allergenFlags}`);
      if (r.drugFlags) parts.push(`- Drug interaction flags: ${r.drugFlags}`);
      if (r.toxicityFlags) parts.push(`- Toxicity flags: ${r.toxicityFlags}`);
      if (r.nutritionalSummary) parts.push(`- Nutritional summary: ${r.nutritionalSummary}`);
      if (r.aiAnalysisSummary) parts.push(`- AI analysis: ${r.aiAnalysisSummary}`);
      if (r.summary) parts.push(`- Summary: ${r.summary}`);
      if (r.product?.ingredientList) {
        const ing = r.product.ingredientList.length > 800
          ? r.product.ingredientList.slice(0, 800) + '…'
          : r.product.ingredientList;
        parts.push(`- Ingredients: ${ing}`);
      }
    }
  }

  // --- Recent reports (compact) ---
  if (ctx.recentReports.length) {
    parts.push('\n# Recent scan history (compact — for quick reference)');
    for (const r of ctx.recentReports) {
      const name = r.product?.name ?? 'Unknown product';
      const score = r.overallScore ?? r.score ?? '—';
      const verdict = r.verdict ?? '—';
      const date = r.reportDate.toISOString().slice(0, 10);
      parts.push(`- [${r.id}] ${name}: ${score} (${verdict}) — ${date}`);
    }
  }

  // --- Memories ---
  if (ctx.memories.length) {
    parts.push('\n# Remembered about this user');
    for (const m of ctx.memories) {
      parts.push(`- [${m.kind}] ${m.content}`);
    }
  }

  return parts.join('\n');
}
