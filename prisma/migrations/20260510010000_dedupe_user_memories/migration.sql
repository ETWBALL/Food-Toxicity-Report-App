-- Dedupe existing rows so the new unique constraint can be created.
DELETE FROM "user_memories" a
USING "user_memories" b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.content = b.content;

-- Prevent future duplicates: extraction LLM tends to re-emit the same
-- canonical facts on every relevant turn.
CREATE UNIQUE INDEX "user_memories_user_id_content_key"
  ON "user_memories"("user_id", "content");
