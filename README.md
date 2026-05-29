# Levit Monorepo

A Turborepo monorepo with a **Next.js** frontend and a **NestJS + Prisma** backend, backed by **Supabase** (managed PostgreSQL).

| App          | Path       | Stack                                              | Default port |
| ------------ | ---------- | -------------------------------------------------- | ------------ |
| `@levit/web` | `apps/web` | Next.js 16, React 19, Tailwind v4 (ixartz starter) | `3000`       |
| `@levit/api` | `apps/api` | NestJS 11 + Prisma 6 (→ Supabase Postgres)         | `3001`       |

> Frontend is [`ixartz/Next-js-Boilerplate`](https://github.com/ixartz/Next-js-Boilerplate); backend is the official NestJS TypeScript starter with Prisma added.

## Structure

```
levit/
├── apps/
│   ├── web/            # Next.js frontend (its own PGlite/Drizzle for local data)
│   └── api/            # NestJS backend
│       ├── prisma/
│       │   └── schema.prisma
│       └── src/
│           └── prisma/ # PrismaService + global PrismaModule
├── package.json        # pnpm workspace + turbo scripts
├── pnpm-workspace.yaml
├── turbo.json
└── Makefile            # `make dev` runs everything
```

## Prerequisites

- Node.js >= 24
- pnpm (`corepack enable` or `npm i -g pnpm`)
- A Supabase project (free tier is fine)

## Quick start

```bash
# 1. install dependencies
make install            # = pnpm install

# 2. configure the backend DB
#    edit apps/api/.env and paste your Supabase connection strings
#    (Supabase dashboard > Settings > Database > Connection string)

# 3. create the tables from the Prisma schema
make db-push

# 4. run frontend + backend together
make dev                # web on :3000, api on :3001
```

`make dev` installs deps, generates the Prisma client, and starts both apps via Turborepo.
The frontend works out of the box (embedded PGlite); the backend connects once `apps/api/.env` has valid Supabase URLs.

## Make commands

| Command           | Description                                              |
| ----------------- | ------------------------------------------------------- |
| `make dev`        | Install + generate Prisma client + run web & api        |
| `make dev-web`    | Run only the frontend                                   |
| `make dev-api`    | Generate Prisma client + run only the backend           |
| `make db-push`    | Sync `schema.prisma` to the database (no migration file)|
| `make db-migrate` | Create + apply a new migration (uses `DIRECT_URL`)      |
| `make db-deploy`  | Apply existing migrations (production)                   |
| `make db-studio`  | Open Prisma Studio                                       |
| `make build`      | Build all apps                                           |
| `make lint`       | Lint all apps                                            |
| `make deploy`     | Production deploy: API → Railway (git push) + Web → Vercel|

## Database (Supabase + Prisma)

`apps/api/prisma/schema.prisma` uses two URLs — this is the one Supabase gotcha:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // POOLED (PgBouncer, port 6543) — runtime queries
  directUrl = env("DIRECT_URL")   // DIRECT  (port 5432)           — migrations
}
```

- **`DATABASE_URL`** → Supabase **pooled** string (port `6543`, `?pgbouncer=true`). Used by the running app.
- **`DIRECT_URL`** → Supabase **direct** string (port `5432`). Used by `prisma migrate` / `db push` (migrations cannot run over the transaction pooler).

Switching to local Postgres or Railway later only means changing these two values — no code changes.

## Connecting frontend → backend

CORS is enabled on the API (`apps/api/src/main.ts`). To call the API from the web app, add the API base URL to the frontend's validated env (`apps/web/src/libs/Env.ts`) and fetch `http://localhost:3001` in dev.

## Deployment

- **Database** → Supabase (already remote; set the same `DATABASE_URL` / `DIRECT_URL` as env vars on the host).
- **Frontend (`apps/web`)** → **Vercel**. Import the repo, set **Root Directory = `apps/web`**. Next.js is native to Vercel.
- **Backend (`apps/api`)** → **Railway** (recommended for a long-running NestJS server). Set **Root Directory = `apps/api`**, build `pnpm build`, start `node dist/main`, and add `DATABASE_URL` + `DIRECT_URL`. (Vercel can also host it via Fluid Compute if you prefer a single platform.)

### `make deploy`

Once the platforms are linked, `make deploy` ships both:

- **API (Railway)** — `git push origin main`; Railway's GitHub integration auto-builds `apps/api` on new commits.
- **Web (Vercel)** — `cd apps/web && vercel --prod` (needs `vercel login` once; project is CLI-deployed, not git-connected).

Live: web `https://levit-trust-web.vercel.app` · API `https://api-production-ca14e.up.railway.app`.
