# Food Toxicity / Safety Report App

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

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd Food-Toxicity-Report-App
npm install
```

### 2. Environment

Copy the example env file and fill in values:

```bash
cp .env.example .env
```

Minimum to run locally:

- **`POSTGRES_URL`** (or **`DATABASE_URL`**) — Postgres connection string
- **`AUTH_SECRET`** — long random string for JWT signing
- **`NEXTAUTH_URL`** — e.g. `http://localhost:3000`

For AI-powered analysis generation:

- **`FEATHERLESS_API_KEY`** (and optionally **`FEATHERLESS_MODEL`**, **`FEATHERLESS_BASE_URL`**)

For catalog write automation or CI:

- **`INTERNAL_API_KEY`** — if set, `POST`/`PUT` `/api/products` require `Authorization: Bearer <key>`; otherwise a logged-in session is required.

See **`.env.example`** for News, FDA, barcode, nutrition keys used by the report orchestrator.

### 3. Database

Generate the Prisma client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
```

(Or `npm run db:push` for prototyping without migration history.)

### 4. Development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` / `npm run start` | Production build & serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:studio` | Prisma Studio GUI |

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

---

## Deploy

Deploy to Vercel, Railway, or any Node host that provides:

- Environment variables from `.env.example`
- A managed Postgres instance
- `npm run build` then `npm run start`, with `npm run db:migrate:prod` (or your migration strategy) on release.

---

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
