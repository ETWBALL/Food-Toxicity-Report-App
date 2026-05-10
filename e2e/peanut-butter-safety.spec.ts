import { test, expect } from './fixtures/auth';

const PEANUT_BARCODE = '628915641769';

/**
 * The core safety contract — peanut butter scanned by a peanut-allergic
 * user MUST be flagged Unsafe / critical regardless of whether Featherless
 * is up. This guards against the live-tested "Safe · 94/100" false negative.
 */
test('peanut butter is flagged Unsafe + critical for a peanut-allergic user', async ({
  page,
  guestUser,
}) => {
  expect(guestUser.id).toBeGreaterThan(0);

  await page.goto('/scan');
  await page.getByRole('button', { name: /enter manually/i }).click();
  await page.getByPlaceholder('Enter barcode number').fill(PEANUT_BARCODE);
  await page.getByRole('button', { name: /generate safety report/i }).click();

  await expect(page.getByText(/safety report/i)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/^Unsafe/i).first()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/critical/i).first()).toBeVisible();
  await expect(page.getByText(/Allergens:\s*peanuts/i)).toBeVisible();

  // Allergen sub-score must be hard-floored to ≤ 25 by applyAllergenSafetyGuard.
  const allergenLabel = page.locator('p', { hasText: /^Allergens$/ }).first();
  const allergenCard = allergenLabel.locator('..');
  const allergenScoreText = await allergenCard.locator('p.text-xl').first().textContent();
  const allergenScore = Number((allergenScoreText ?? '').trim());
  expect(allergenScore).toBeGreaterThanOrEqual(0);
  expect(allergenScore).toBeLessThanOrEqual(25);
});

/**
 * Soft check — Featherless trial tier rate-limits aggressively, so we don't
 * fail the build if AI is unavailable. We only assert the panel renders
 * when AI succeeds, proving the retry-on-502 wiring works end-to-end.
 */
test('AI Safety Analysis panel renders when Featherless succeeds', async ({
  page,
  guestUser,
}) => {
  expect(guestUser.id).toBeGreaterThan(0);

  await page.goto('/scan');
  await page.getByRole('button', { name: /enter manually/i }).click();
  await page.getByPlaceholder('Enter barcode number').fill(PEANUT_BARCODE);
  await page.getByRole('button', { name: /generate safety report/i }).click();

  await expect(page.getByText(/^Unsafe/i).first()).toBeVisible({ timeout: 120_000 });

  const aiPanel = page.getByRole('heading', { name: /ai safety analysis/i });
  try {
    await expect(aiPanel).toBeVisible({ timeout: 60_000 });
  } catch {
    test.skip(true, 'Featherless model unavailable — skipping AI panel assertion');
  }
});

/**
 * The chat must be able to explain sub-score reasoning, since the prompt
 * prefix now injects all six axis scores plus the legend.
 */
test('chat explains why allergen sub-score is low', async ({ guestUser, page }) => {
  expect(guestUser.id).toBeGreaterThan(0);
  const request = page.request;

  const reportRes = await request.post('/api/reports', { data: { barcode: PEANUT_BARCODE } });
  if (!reportRes.ok()) {
    const body = await reportRes.text().catch(() => '');
    throw new Error(`Report creation failed: ${reportRes.status()} ${body.slice(0, 200)}`);
  }
  const { report } = await reportRes.json();
  expect(report.id).toBeGreaterThan(0);
  expect(report.allergenScore).toBeLessThanOrEqual(25);

  // Best-effort AI deepening (retry once on 502, ignore failure).
  const aiOpts = { data: { reportId: report.id }, timeout: 60_000 };
  let aiRes = await request.post('/api/analysis/generate', aiOpts);
  if (aiRes.status() === 502) {
    aiRes = await request.post('/api/analysis/generate', aiOpts);
  }

  const sessionRes = await request.post('/api/chat/sessions', { data: {} });
  expect(sessionRes.ok()).toBeTruthy();
  const { id: sessionId } = await sessionRes.json();

  const msgRes = await request.post(`/api/chat/sessions/${sessionId}/messages`, {
    data: {
      content: 'Why is the allergen score low for this product?',
      reports: [report.id],
    },
    timeout: 60_000,
  });
  if (!msgRes.ok()) {
    test.skip(true, `Featherless chat failed (${msgRes.status()}) — likely concurrency limit`);
  }

  const { assistantMessage } = await msgRes.json();
  const reply = (assistantMessage?.content ?? '').toLowerCase();
  expect(reply).toMatch(/peanut/);
  expect(reply).toMatch(/score|0\/100|low|allergen/);
});
