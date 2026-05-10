import { fetchJson } from '@/lib/integrations/fetch';

/** DailyMed SPL search — no API key. */
export type DailyMedSplHit = {
  setid?: string;
  title?: string;
  published_date?: string;
};

export async function searchDailyMedSpl(drugName: string): Promise<DailyMedSplHit | null> {
  const term = drugName.trim().slice(0, 120);
  if (!term) return null;

  const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spl.json?search=${encodeURIComponent(term)}&pagesize=1`;
  const res = await fetchJson<Record<string, unknown>>(url, {
    timeoutMs: 12_000,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) return null;
  const d = res.data;
  const arr =
    (Array.isArray(d.data) ? d.data : null) ??
    (Array.isArray(d.spls) ? d.spls : null) ??
    (Array.isArray(d.results) ? d.results : null);
  if (!arr?.length) return null;
  const x = arr[0] as Record<string, unknown>;
  return {
    setid: typeof x.setid === 'string' ? x.setid : undefined,
    title: typeof x.title === 'string' ? x.title : undefined,
    published_date: typeof x.published_date === 'string' ? x.published_date : undefined,
  };
}
