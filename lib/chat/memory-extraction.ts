import { prisma } from '@/lib/prisma';
import { featherlessChat } from '@/lib/integrations/featherless';

/**
 * Best-effort post-turn memory extraction. Calls Featherless with a tight
 * prompt asking for any reusable user preferences/observations/feedback,
 * then persists each bullet as a UserMemory row.
 *
 * Failure is swallowed — the chat reply has already shipped, and an empty
 * memory store is correct behavior, not a regression.
 */
export async function extractAndSaveMemories(params: {
  userId: number;
  userMessage: string;
  assistantMessage: string;
}): Promise<number> {
  const { userId, userMessage, assistantMessage } = params;

  const trimmedAssistant = assistantMessage.length > 600
    ? assistantMessage.slice(0, 600) + '…'
    : assistantMessage;

  const extractionPrompt = `From this exchange, extract any DURABLE facts about the user worth remembering across future conversations:
- preferences (e.g., "prefers concise warnings")
- observations (e.g., "is concerned about high sodium")
- feedback (e.g., "found the recall warning unclear")

Rules:
- Output one bullet per line, prefixed with "- "
- Each bullet 5-150 chars, in third person ("user ...")
- Skip transient/contextual details (one-off questions, product-specific facts)
- If nothing durable, output literally NONE

USER: ${userMessage}
ASSISTANT: ${trimmedAssistant}

Bullets:`;

  let raw: string;
  try {
    raw = await featherlessChat({
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.2,
      maxTokens: 256,
    });
  } catch {
    return 0;
  }

  if (/^\s*none\s*$/i.test(raw)) return 0;

  const bullets = raw
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•]\s*/, ''))
    .filter((line) => line.length >= 5 && line.length <= 200)
    .filter((line) => !/^none$/i.test(line))
    .slice(0, 5);

  if (bullets.length === 0) return 0;

  try {
    await prisma.userMemory.createMany({
      data: bullets.map((content) => ({
        userId,
        kind: 'observation',
        content,
      })),
    });
  } catch {
    return 0;
  }

  return bullets.length;
}
