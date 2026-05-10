/**
 * IBM watsonx.ai chat integration.
 *
 * Required env vars:
 *   WATSONX_API_KEY      – IBM Cloud IAM API key
 *   WATSONX_PROJECT_ID   – watsonx.ai project ID
 *
 * Optional:
 *   WATSONX_URL          – defaults to https://us-south.ml.cloud.ibm.com
 *   WATSONX_MODEL        – defaults to meta-llama/llama-3-1-70b-instruct
 */

const DEFAULT_URL = 'https://us-south.ml.cloud.ibm.com';
const DEFAULT_MODEL = 'meta-llama/llama-3-1-70b-instruct';
const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const CHAT_API_VERSION = '2024-05-01';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** In-memory IAM token cache (valid ~1 h). Survives the process lifetime. */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getIamToken(apiKey: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`watsonx IAM token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!json.access_token) {
    throw new Error('watsonx IAM response missing access_token');
  }

  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

type WatsonxChatResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string };
};

export type WatsonxCallResult =
  | { ok: true; content: string }
  | { ok: false; status: number; error: string };

export async function watsonxChat(params: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<WatsonxCallResult> {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;

  if (!apiKey || !projectId) {
    return { ok: false, status: 0, error: 'WATSONX_API_KEY or WATSONX_PROJECT_ID not set' };
  }

  const base = (process.env.WATSONX_URL ?? DEFAULT_URL).replace(/\/$/, '');
  const model = process.env.WATSONX_MODEL ?? DEFAULT_MODEL;

  let token: string;
  try {
    token = await getIamToken(apiKey);
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }

  const url = `${base}/ml/v1/text/chat?version=${CHAT_API_VERSION}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: model,
        messages: params.messages,
        project_id: projectId,
        parameters: {
          max_new_tokens: params.maxTokens ?? 4096,
          temperature: params.temperature ?? 0.35,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'watsonx fetch failed' };
  }

  let json: WatsonxChatResponse;
  try {
    json = (await res.json()) as WatsonxChatResponse;
  } catch {
    return { ok: false, status: res.status, error: `watsonx non-JSON response (${res.status})` };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json.error?.message ?? `watsonx error ${res.status}`,
    };
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    return { ok: false, status: 502, error: 'watsonx returned empty completion' };
  }

  return { ok: true, content };
}
