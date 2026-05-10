import { fetchJson } from '@/lib/integrations/fetch';

const DEFAULT_BASE = 'https://api.featherless.ai/v1';
/** OpenAI-compatible name on Featherless; override with FEATHERLESS_MODEL if your catalog uses a different slug. */
const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-70B-Instruct';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
};

type CallResult =
  | { ok: true; content: string }
  | { ok: false; status: number; error: string };

async function callFeatherlessOnce(
  key: string,
  base: string,
  model: string,
  params: { messages: ChatMessage[]; temperature?: number; maxTokens?: number },
): Promise<CallResult> {
  const url = `${base}/chat/completions`;
  const res = await fetchJson<ChatCompletionResponse>(url, {
    method: 'POST',
    timeoutMs: 120_000,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.35,
      max_tokens: params.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) return { ok: false, status: res.status, error: res.error };

  const content = res.data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    return {
      ok: false,
      status: 502,
      error: res.data.error?.message || 'Empty completion from Featherless',
    };
  }
  return { ok: true, content };
}

function isRateLimited(r: { status: number; error: string }): boolean {
  if (r.status === 429) return true;
  const msg = (r.error || '').toLowerCase();
  return /rate.?limit|too many requests|quota/.test(msg);
}

export async function featherlessChat(params: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const primary = process.env.FEATHERLESS_API_KEY;
  const fallback = process.env.FEATHERLESS_API_KEY_FALLBACK;
  if (!primary) {
    throw new Error('FEATHERLESS_API_KEY is not set');
  }

  const base = (process.env.FEATHERLESS_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const model = process.env.FEATHERLESS_MODEL ?? DEFAULT_MODEL;

  const first = await callFeatherlessOnce(primary, base, model, params);
  if (first.ok) return first.content;

  if (fallback && isRateLimited(first)) {
    const second = await callFeatherlessOnce(fallback, base, model, params);
    if (second.ok) return second.content;
    throw new Error(
      `Featherless request failed (primary ${first.status}: ${first.error}; fallback ${second.status}: ${second.error})`,
    );
  }

  throw new Error(`Featherless request failed: ${first.error}`);
}
