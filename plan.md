# SafeScan Build Plan (Template -> Hackathon App)

## 1) Goal
Convert this Next.js + Tailwind + NextAuth starter into **SafeScan**: barcode scan -> recall + ingredient + profile risk analysis -> toxicity report (0-100) with AI summary.

---

## 2) Target Stack (MVP)
- Frontend: Next.js 14 App Router + Tailwind + `react-qr-barcode-scanner`
- Auth: existing NextAuth starter (email/password + guest mode)
- DB: Postgres (Neon) via Drizzle
- API strategy for hackathon:
  - **Now (fastest):** Next.js Route Handlers under `/app/api/...`
  - **Later (optional split):** move heavy analysis/sync to FastAPI service
- AI: OpenAI/Watsonx through a single backend adapter

---

## 3) Core Product Flow
1. User logs in (or guest).
2. User opens scan popup and scans barcode with camera.
3. Frontend calls scan endpoint with barcode.
4. Backend resolves product (cache -> OpenFoodFacts fallback).
5. Backend checks active recalls (local pre-synced tables).
6. Backend checks user profile risks (allergens, meds, conditions).
7. Backend computes safety score + verdict.
8. Backend calls AI for plain-language summary (cached).
9. Backend stores scan + report.
10. Frontend shows toxicity report page + scan history snippet.

---

## 4) Pages To Build
- `/` Landing/dashboard:
  - Scan button
  - News feed (food/drug/supplement safety)
  - Recent scans
- `/login`
- `/signup` (or `/register` mapped to signup UX)
- `/settings`:
  - allergies, medications, conditions, dietary restrictions
- Scan UI:
  - modal/popover scanner using `react-qr-barcode-scanner`
- `/report/[reportId]` Toxicity report result screen

---

## 5) Data Model (Drizzle)
Add/extend tables:

1. `users` (existing) + profile fields
   - `knownAllergies` (jsonb/text[])
   - `currentMedications` (jsonb/text[])
   - `healthConditions` (jsonb/text[])
   - `dietaryRestrictions` (jsonb/text[])

2. `products`
   - `id`, `barcode`, `name`, `brand`, `type` (food/drug/supplement)
   - `ingredientsText`, `ingredientsNormalized` (jsonb)
   - `allergens` (jsonb), `nutrition` (jsonb), `imageUrl`
   - `source`, `lastFetchedAt`

3. `recalls`
   - `id`, `source` (FDA/HC), `recallNumber`, `productName`
   - `reason`, `severity`, `recallDate`, `status`
   - `rawPayload` (jsonb)

4. `product_recalls`
   - `productId`, `recallId`, `matchType`, `confidence`

5. `scan_history`
   - `id`, `userId`, `barcode`, `productId`, `score`, `verdict`, `createdAt`

6. `reports`
   - `id`, `userId`, `scanId`, `productId`
   - `score`, `verdict`, `riskFlags` (jsonb)
   - `aiSummary`, `aiModel`, `analysisVersion`

7. `ai_analysis_cache`
   - `id`, `productId`, `analysisType`, `inputHash`, `output`, `createdAt`

---

## 6) API Design (MVP Mapping)
Use your endpoint list with small practical changes:

- Keep your auth/users/profile/product/scan/report/recall/analysis routes.
- Prefer REST route handlers in `app/api/...`.
- Add one orchestration endpoint for fastest frontend integration:
  - `POST /api/scan/analyze`
  - Input: `{ barcode }`
  - Output: product + recalls + profile risks + score + reportId + aiSummary

This avoids 4-6 client roundtrips per scan during the hackathon.

---

## 7) Where Barcode Webhook + AI Calls Happen

## Barcode flow (frontend -> backend)
- In scanner component (`ScanModal`), on successful decode:
  - call `POST /api/scan/analyze` with barcode.
  - then navigate to `/report/[reportId]`.

## "AI barcode webhook" placement
- If you have an external barcode intelligence webhook/provider:
  - call it **server-side only** inside `POST /api/scan/analyze`
  - never from browser (protect keys, normalize errors)
  - timeout fallback: continue with OpenFoodFacts + local logic

## AI analysis call placement
- AI should be called from backend in:
  - `POST /api/analysis/generate` (direct endpoint), or
  - inside `POST /api/scan/analyze` (orchestrated path)
- Recommendation for hackathon: call AI inside `/api/scan/analyze` and cache result.

## Later endpoint swap ("we change it later")
- Add env-based provider adapter now:
  - `ANALYSIS_BACKEND=next|fastapi`
  - if `next`: use local route/service
  - if `fastapi`: proxy from Next route to external FastAPI URL
- Keep frontend unchanged (still calls `/api/scan/analyze`).

---

## 8) Scoring Logic (v1)
Score starts at 100, subtract penalties:
- Active recall: -40 to -80 (by severity)
- User allergen hit: -25 each (hard floor to Unsafe)
- Medication conflict: -15 to -35 each (AI confidence weighted)
- High-risk condition trigger: -10 to -25
- Nutrition warnings (optional MVP-lite): -5 to -15

Verdicts:
- `80-100` Safe
- `50-79` Caution
- `0-49` Unsafe

---

## 9) News + Alternatives
- News feed endpoint: `GET /api/news?query=...&type=food|drug|supplement`
- Run server-side web aggregation + summary with source links.
- Alternatives endpoint:
  - `GET /api/products/:id/alternatives`
  - heuristic: same category/brand class + better score + common substitutes.

---

## 10) 3-Day Execution (Repo Task Breakdown)
Day 1:
- DB schema + migrations
- Recall sync scripts + seed
- Product lookup service (OpenFoodFacts)
- Basic `/api/scan/analyze` stub

Day 2:
- Scanner UI + report page
- Full risk logic + scoring
- AI summary integration + cache
- Settings/profile management

Day 3:
- News feed + alternatives polish
- UX cleanup, latency tuning, demo script, deploy

---

## 11) Additional Required Items (Add These)
- Guest flow endpoint: `POST /api/auth/guest`
- Rate limiting for scan + AI endpoints
- Input validation (zod) for all POST/PUT routes
- Audit fields (`createdAt`, `updatedAt`) everywhere
- Basic telemetry/logging for scan latency + AI failures
- Fallback mode when AI is down (still return deterministic score)
- Legal disclaimer on report page (non-medical advice)
- Seed/demo barcodes for judge demo reliability

---

## 12) File/Folder Plan
- `app/(public)/page.tsx` dashboard/landing
- `app/settings/page.tsx`
- `app/report/[reportId]/page.tsx`
- `components/scan-modal.tsx`
- `components/toxicity-report.tsx`
- `app/api/scan/analyze/route.ts`
- `app/api/reports/route.ts`
- `app/api/analysis/generate/route.ts`
- `app/api/recalls/check/[barcodeNumber]/route.ts`
- `lib/services/{product,recall,analysis,score}.ts`
- `lib/providers/ai.ts` (adapter for next vs fastapi)
- `drizzle/schema.ts` (+ migration files)
- `scripts/sync-fda-recalls.ts`
- `scripts/sync-health-canada-recalls.ts`

---

## 13) Definition of Done (Hackathon MVP)
- Scan any product barcode from mobile camera.
- Get result in ~<2s median with score + verdict + key risks.
- Report shows recall status, allergen flags, med conflicts, AI summary.
- User can edit profile and see personalized results change.
- Last 10 scans visible.
- Deployed live URL + stable demo path.

---

## 14) DB Integration Plan (Implementation Order)
1. Baseline config
- Use `.env.local` from `.env.example`.
- Set `DATABASE_URL` (or `POSTGRES_URL`) to Neon.
- Use `drizzle.config.ts` + `lib/db/schema.ts`.

2. Migration workflow
- Generate first migration: `npm run db:generate`
- Apply migration: `npm run db:migrate` (or `npm run db:push` for hackathon speed)
- Commit `drizzle/` artifacts.

3. Refactor current auth DB access
- Replace runtime `ensureTableExists()` in `app/db.ts`.
- Move auth reads/writes to `lib/db/client.ts` + `lib/db/schema.ts`.
- Keep NextAuth behavior unchanged during this refactor.

4. Add feature repositories/services
- `lib/services/product.ts`
- `lib/services/recall.ts`
- `lib/services/scan.ts`
- `lib/services/report.ts`
- Each service should only read/write through Drizzle.

5. Data ingestion jobs
- Nightly scripts populate `recalls`.
- Product lookups upsert into `products`.
- Scan analysis writes to `scan_history` + `reports`.

6. Performance + correctness guardrails
- Indexes: `products.barcode`, `recalls.status`, `scan_history.user_id`, `reports.user_id`.
- Add unique constraints where needed (e.g., barcode).
- Wrap scan+report writes in transaction.

7. Release strategy
- Step A: run on staging DB with seed barcodes.
- Step B: run smoke test routes (`/api/scan/analyze`, `/api/reports/:id`).
- Step C: cut over production env vars and deploy.
