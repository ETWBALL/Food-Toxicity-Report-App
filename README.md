# Food Toxicity / Safety Report App

## hosted: https://safe-scan-nine.vercel.app/

A **Next.js 14** application that helps users assess food and product safety using **barcode or product name**, combining **open data** (Open Food Facts, openFDA recalls and adverse events, news) with **optional AI analysis** (Featherless / Llama-class models). Users authenticate with **email and password** or **guest mode**; sessions use **JWT access + refresh tokens** in **httpOnly cookies**.

Core flows:

- **POST `/api/reports`** — Full orchestrated pipeline: aggregates external signals, scores risk, persists a `SafetyReport`.
- **POST `/api/analysis/generate`** — Refines an existing report with structured AI output and syncs linked scan scores when present.
- **POST `/api/users/:id/scans`** — Lightweight per-scan flow with deterministic scoring, recalls, allergy/drug hints, and a short AI summary.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | Next.js (App Router), React 18 |
| Database | PostgreSQL (e.g. Neon) via **Prisma** |
| Auth | Custom JWT (**jose**), bcrypt passwords, **tokenVersion** invalidation |
| Validation | **Zod** |
| AI | Featherless OpenAI-compatible API (`FEATHERLESS_*` env vars) |

---

## Prerequisites

- **Node.js 18+**
- A **PostgreSQL** database URL
- Optional API keys for external services (see `.env.example`)

---


## API overview

Every route handler under `app/api/**/route.ts` has a **file-level JSDoc block** describing methods, auth, JSON shapes, and status codes. Summary:

| Area | Routes |
|------|--------|
| **Auth** | `POST /api/auth/register`, `login`, `guest`, `logout`, `refresh`; NextAuth catch‑all `/api/auth/*` |
| **User** | `GET`/`PUT`/`DELETE /api/users/:id`; lists: `.../allergies`, `medications`, `conditions`, `reports`, `scans` |
| **Scans** | `GET`/`POST /api/users/:id/scans`; `GET`/`DELETE /api/users/:id/scans/:scanId` |
| **Reports** | `POST /api/reports`; `GET /api/reports/:reportId` |
| **Analysis** | `POST /api/analysis/generate`; legacy `GET /api/analysis/:productId/:type` |
| **Products** | `POST /api/products`; `GET`/`PUT /api/products/:id`; `GET /api/products/barcode/:barcodeNumber`; `GET /api/products/:id/recalls` |
| **Recalls** | `GET /api/recalls`; `GET /api/recalls/:recallId`; `POST /api/recalls/check/:barcodeNumber` |

**Authentication:** Most user endpoints expect cookies set by login/register/guest/refresh, or compatible Bearer usage where implemented. Send JSON with `Content-Type: application/json` unless noted.


## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
