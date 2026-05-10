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

export async function featherlessChat(params: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const key = process.env.FEATHERLESS_API_KEY;
  if (!key) {
    throw new Error('FEATHERLESS_API_KEY is not set');
  }

  const base = (process.env.FEATHERLESS_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const model = process.env.FEATHERLESS_MODEL ?? DEFAULT_MODEL;
  const url = `${base}/chat/completions`;

  const res = await fetchJson<ChatCompletionResponse>(
    url,
    {
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
    },
  );

  if (!res.ok) {
    throw new Error(`Featherless request failed: ${res.error}`);
  }

  const content = res.data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error(res.data.error?.message || 'Empty completion from Featherless');
  }

  return content;
}
