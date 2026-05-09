export type ScoreInputs = {
  recallActive: boolean;
  recallSeverity?: string | null;
  allergyFlags: string[];
  drugFlags: string[];
  userProfileExists: boolean;
};

export type Verdict = 'Safe' | 'Caution' | 'Unsafe';

export type ScoreResult = {
  score: number;
  verdict: Verdict;
  isPersonalized: boolean;
};

const CLASS_DEDUCTIONS: Record<string, number> = {
  'Class I': 30,
  'Class II': 20,
  'Class III': 10,
};

export function computeScore(inputs: ScoreInputs): ScoreResult {
  let score = 100;
  let hardUnsafe = false;

  if (inputs.recallActive) {
    score -= 50;
    const sev = inputs.recallSeverity ?? '';
    if (CLASS_DEDUCTIONS[sev]) score -= CLASS_DEDUCTIONS[sev];
    if (sev === 'Class I') hardUnsafe = true;
  }

  score -= 20 * inputs.allergyFlags.length;
  score -= 20 * inputs.drugFlags.length;
  score = Math.max(0, score);

  let verdict: Verdict;
  if (hardUnsafe || score < 50) verdict = 'Unsafe';
  else if (score < 80) verdict = 'Caution';
  else verdict = 'Safe';

  return { score, verdict, isPersonalized: inputs.userProfileExists };
}

const SEVERITY_RANK: Record<string, number> = {
  'Class I': 3,
  'Class II': 2,
  'Class III': 1,
};

export function worstSeverity(severities: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestRank = 0;
  for (const s of severities) {
    if (!s) continue;
    const r = SEVERITY_RANK[s] ?? 0;
    if (r > bestRank) {
      best = s;
      bestRank = r;
    }
  }
  return best;
}
