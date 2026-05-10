/** Shared fetch helper with timeout for external integrations */

export type FetchJsonResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error: string };

export async function fetchJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<FetchJsonResult<T>> {
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const { timeoutMs: _, ...init } = options ?? {};

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!text) {
      return res.ok
        ? { ok: true, data: {} as T, status: res.status }
        : { ok: false, status: res.status, error: 'Empty body' };
    }
    try {
      const data = JSON.parse(text) as T;
      if (!res.ok) {
        return { ok: false, status: res.status, error: text.slice(0, 200) };
      }
      return { ok: true, data, status: res.status };
    } catch {
      return { ok: false, status: res.status, error: 'Invalid JSON' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return { ok: false, status: 0, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export function openfdaKeyQuery(): string {
  const key = process.env.FDA_OPENFDA_API_KEY || process.env.OPENFDA_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : '';
}
