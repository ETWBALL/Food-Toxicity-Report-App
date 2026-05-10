/**
 * Unified AI chat function.
 *
 * Priority order:
 *   1. watsonx.ai (IBM Cloud) — if WATSONX_API_KEY + WATSONX_PROJECT_ID are set
 *   2. Featherless (primary key)  — if FEATHERLESS_API_KEY is set
 *   3. Featherless (fallback key) — if primary is rate-limited and FEATHERLESS_API_KEY_FALLBACK is set
 *
 * Throws if all providers fail.
 */

import { featherlessChat } from '@/lib/integrations/featherless';
import { watsonxChat } from '@/lib/integrations/watsonx';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function aiChat(params: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const hasWatsonx = !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID);

  if (hasWatsonx) {
    const result = await watsonxChat(params);
    if (result.ok) return result.content;
    // Log and fall through to featherless
    console.warn(`[aiChat] watsonx failed (${result.status}): ${result.error} — falling back to Featherless`);
  }

  // featherlessChat already handles primary + fallback key internally
  return featherlessChat(params);
}
