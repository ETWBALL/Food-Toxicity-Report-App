import { fetchJson } from '@/lib/integrations/fetch';

/** RxNorm approximate match — no API key; respect ~20 rps. */
export type RxNormCandidate = {
  name?: string;
  rxcui?: string;
};

export async function rxnormApproximateCandidates(term: string): Promise<RxNormCandidate[]> {
  const t = term.trim().slice(0, 100);
  if (!t) return [];

  const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(t)}&maxEntries=5`;
  const res = await fetchJson<{
    approximateGroup?: { candidate?: Array<{ name?: string; rxcui?: string }> };
  }>(url, { timeoutMs: 8000 });

  if (!res.ok || !res.data.approximateGroup?.candidate) return [];
  const raw = res.data.approximateGroup.candidate;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((c) => ({
    name: c.name,
    rxcui: c.rxcui != null ? String(c.rxcui) : undefined,
  }));
}
