# AI Provider Strategy

SafeScan uses Featherless (Llama-3.1-70B) as primary. This document describes how to plug in additional providers (cloud backups) without changing call sites.

## Current state

- Single integration: [`featherlessChat`](../lib/integrations/featherless.ts)
- Primary key: `FEATHERLESS_API_KEY`
- Built-in 429/quota fallback to `FEATHERLESS_API_KEY_FALLBACK` (same provider, second key)
- Used by: [`safety-report-response.ts`](../lib/reports/safety-report-response.ts), [`messages/route.ts`](../app/api/chat/sessions/[id]/messages/route.ts)

## Recommended multi-cloud design

Introduce `lib/ai/provider.ts` with a uniform contract:

```ts
export type ChatProvider = (args: {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) => Promise<{ content: string; provider: string }>;
```

Then create thin adapters:

| Provider          | Adapter file                          | Env vars                                                   |
| ----------------- | ------------------------------------- | ---------------------------------------------------------- |
| Featherless       | `lib/ai/providers/featherless.ts`     | `FEATHERLESS_API_KEY`, `FEATHERLESS_API_KEY_FALLBACK`      |
| OpenAI            | `lib/ai/providers/openai.ts`          | `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`)   |
| Anthropic         | `lib/ai/providers/anthropic.ts`       | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`                     |
| AWS Bedrock       | `lib/ai/providers/bedrock.ts`         | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Azure OpenAI      | `lib/ai/providers/azure.ts`           | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`            |
| Google Vertex AI  | `lib/ai/providers/vertex.ts`          | `GOOGLE_APPLICATION_CREDENTIALS`, `GCP_PROJECT_ID`         |
| IBM watsonx.ai    | `lib/ai/providers/watsonx.ts`         | `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`                    |

### Router

`lib/ai/router.ts` exports `chatWithFallback(args)`:

1. Read ordered list from `AI_PROVIDER_ORDER` (e.g. `featherless,openai,anthropic`).
2. Try providers in order.
3. Retry the *next* provider only on:
   - HTTP `429` / `quota_exceeded` / `rate_limit_exceeded`
   - HTTP `5xx` / network error
   - Adapter `timeout` (>30s)
4. On hard validation errors (`400`, `401`), surface immediately — do not waste budget on the fallback.
5. Emit a structured log entry per attempt: `{ ts, provider, model, ms, status, tokensIn, tokensOut, cost?, error? }`.

### Cost & latency budget

- Add `AI_TIMEOUT_MS` (default 30000) per attempt.
- Add `AI_MAX_ATTEMPTS` (default 2). Never iterate more than this — exposes runaway loops.
- Track `aiAttempts` on `SafetyReport` for observability.

### Choosing a model per use case

| Use case               | Quality target | Suggested defaults                              |
| ---------------------- | -------------- | ----------------------------------------------- |
| Safety report analysis | High           | `featherless/llama-3.1-70b` → `gpt-4o-mini`     |
| Chat (RAG-grounded)    | Medium         | `featherless/llama-3.1-70b` → `claude-haiku`    |
| Memory extraction      | Cheap          | `gpt-4o-mini` only (already small JSON output)  |

Override per call via `AI_MODEL_REPORT`, `AI_MODEL_CHAT`, `AI_MODEL_MEMORY`.

## Environment variables (Vercel)

Required for production:

```
POSTGRES_URL=...
AUTH_SECRET=...                          # 32+ random bytes
FEATHERLESS_API_KEY=...
```

Optional but recommended:

```
FEATHERLESS_API_KEY_FALLBACK=...
AI_PROVIDER_ORDER=featherless,openai
OPENAI_API_KEY=...
AI_TIMEOUT_MS=30000
AI_MAX_ATTEMPTS=2
```

## Testing

- `lib/ai/router.test.ts` should mock each adapter and assert:
  1. First-success returns immediately (no second call).
  2. 429 from primary triggers fallback exactly once.
  3. 401 from primary does NOT trigger fallback.
  4. All-fail returns a structured error, never throws into the route handler.

## Migration plan

1. Land the `lib/ai/provider.ts` contract + featherless adapter (mechanical refactor — no behavior change).
2. Replace direct `featherlessChat` calls with `chatWithFallback`.
3. Add `openai` adapter behind feature flag `AI_PROVIDER_ORDER`.
4. Validate in staging with synthetic 429s.
5. Promote to prod.
