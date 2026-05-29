# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

pnpm + Turborepo monorepo. `@levit/web` (Next.js 16, ixartz starter, port 3000) + `@levit/api` (NestJS 11 + Prisma 6 → Supabase Postgres, port 3001). Domain: a **kids-supplement safety checker** that flags duplicate/over-intake (중복·과다) of nutrients against Korean KDRIs standards. README.md covers setup; this file covers the non-obvious wiring.

## Commands

Run from repo root (Turborepo fans out); `make` is the everyday entry point.

```bash
make dev                 # install + prisma generate + run web & api together
make dev-api             # api only (:3001, needs apps/api/.env DB URLs)
make dev-web             # web only (:3000)
make db-push             # sync schema.prisma → DB (uses DIRECT_URL)
pnpm --filter @levit/api db:seed     # load KDRIs standards + demo products (ts-node prisma/seed.ts)

# API (NestJS) tests — Jest, *.spec.ts colocated in src/
pnpm --filter @levit/api test                    # all unit
pnpm --filter @levit/api test -- rules/verdict    # one file (path regex)
pnpm --filter @levit/api test -- -t "OVER"        # one test by name
pnpm --filter @levit/api test:e2e                 # e2e (test/, separate jest config)

pnpm --filter @levit/web check:types     # web typecheck (tsc --noEmit)
pnpm --filter @levit/web lint            # ultracite (oxlint, type-aware)
pnpm --filter @levit/api crawl           # iHerb catalog crawler stub
```

## Architecture

### `/analyze` pipeline — the LLM trust boundary (read this first)

The single most important design rule: **a deterministic rule engine computes the safety verdict; the LLM only writes prose and must never be able to change or block a verdict.**

`AnalysisController` (POST `/analyze`) → `AnalysisService` (loads catalog from Prisma) → `rules/` pipeline → `ExplanationService`. The `rules/` modules compose in order:

- `units.ts` — normalize amounts to a canonical unit per nutrient
- `reference.ts` — pick the `IntakeReference` (KDRIs RDA + upper limit) for the child's age band
- `aggregate.ts` — sum one nutrient across all products in the cart
- `verdict.ts` — decide `SAFE | DUPLICATE | OVER | UNKNOWN`
- `analyze.ts` — orchestrator
- `verify-explanation.ts` — guardrail that rejects LLM output containing hallucinated numbers or a verdict that contradicts the rule engine, failing safe to a fallback string

Domain rules that are easy to get wrong:
- `OVER` fires **only when the total exceeds the upper limit (UL)** — not when it merely exceeds the recommended amount. A nutrient at 500% of RDA but under UL is `SAFE`/`DUPLICATE`, never `OVER`. This "no false alarms" property is load-bearing for trust; preserve it.
- A nutrient with **no KDRIs standard → `UNKNOWN`** ("확인 불가"), never silently `SAFE`.

The OpenAI client is provided via DI in `analysis.module.ts` and falls back to `'sk-no-key-set'`; any explanation failure (missing key, invalid key, **quota exhaustion**) degrades to a safe string. `/analyze` therefore returns correct verdicts with no/invalid OpenAI key — explanations just become a fallback line.

### Web — a PUBLIC checker on the ixartz boilerplate

- Routes are locale-prefixed under `src/app/[locale]/`. The middleware is **`src/proxy.ts`** (ixartz names it `proxy`, not `middleware`). It only auth-protects `/dashboard`; the `(checker)` route group has **no `ClerkProvider`**, so **`/check` is public** (no login). Don't add auth gating there.
- `/check` (`'use client'`) flow: `PersonaLanding` → `ProductPicker` → `AgeStep` → `analyze()` → `ReportCard` + `RecommendedSetCard`, all in `src/components/checker/`. Strings are hardcoded Korean (MVP — not the next-intl catalog).
- **Persona presets (`personaScenarios.ts`) reference products by NAME**, resolved to ids at runtime from `GET /products`, because seed PKs change on every reseed. Names not in the catalog are skipped with a warn.
- `src/libs/Api.ts` is the typed client to the NestJS API via `NEXT_PUBLIC_API_URL` (env-validated in `src/libs/Env.ts`, t3-env). The web app also ships ixartz's own PGlite/Drizzle DB — **the checker does NOT use it**; the checker talks only to the external NestJS API.

### Database (Supabase + Prisma)

`apps/api/prisma/schema.prisma` uses two URLs (gitignored `apps/api/.env`): `DATABASE_URL` = pooled (6543, `?pgbouncer=true`) for runtime, `DIRECT_URL` = direct (5432) for `prisma migrate`/`db push`. Key models: `Product`/`Ingredient`/`ProductIngredient` (catalog), `IntakeReference` (age-banded RDA+UL), `Analysis*` (persisted runs).

## Conventions

- **Decision log**: append a 3-line entry (`요구사항` / `고민` / `해결`) to `docs/submission/engineering-decisions.md` for each meaningful change — it's the take-home's running rationale log.
- Backend changes follow an implementer → spec-review → quality-review loop (see commit history); frontend hasn't been through that loop yet.
- Design/plan docs live in `docs/plans/`; persona research in `docs/personas/`.

## Gotchas

- `localhost:3000` can resolve to another local project's dev server on IPv6 (`::1`) while this app binds IPv4 (`*:3000`). Use **`http://127.0.0.1:3000`** to be sure you're hitting this app.
- After pulling new dependencies, run `pnpm install` before testing — e.g. `openai` must be installed or the API test suite fails to load `explanation.service`.
