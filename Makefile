.DEFAULT_GOAL := help
.PHONY: help install generate db-push db-migrate db-deploy db-studio dev dev-web dev-api build lint test clean deploy deploy-api deploy-web

## help: list available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //'

## install: install all workspace dependencies (pnpm)
install:
	pnpm install

## generate: generate the Prisma client (no DB connection needed)
generate:
	pnpm --filter @levit/api prisma:generate

## db-push: sync the Prisma schema to the database (Supabase/Postgres)
db-push:
	pnpm --filter @levit/api db:push

## db-migrate: create and apply a new migration (uses DIRECT_URL)
db-migrate:
	pnpm --filter @levit/api db:migrate

## db-deploy: apply existing migrations (production)
db-deploy:
	pnpm --filter @levit/api db:deploy

## db-studio: open Prisma Studio
db-studio:
	pnpm --filter @levit/api db:studio

## dev: install deps, generate Prisma client, then run web + api together
dev: install generate
	pnpm dev

## dev-web: run only the Next.js frontend
dev-web:
	pnpm dev:web

## dev-api: generate Prisma client, then run only the NestJS backend
dev-api: generate
	pnpm dev:api

## build: build all apps
build:
	pnpm build

## lint: lint all apps
lint:
	pnpm lint

## test: run all tests
test:
	pnpm test

## clean: remove build artifacts and node_modules
clean:
	pnpm -r exec rm -rf node_modules dist .next .turbo
	rm -rf node_modules

## deploy: production deploy — API (Railway, via git push) + Web (Vercel CLI)
deploy: deploy-api deploy-web
	@echo "✅ Deploy triggered. Web: https://levit-trust-web.vercel.app  API: https://api-production-ca14e.up.railway.app"

## deploy-api: deploy the NestJS API — Railway auto-builds on push to main (Root: apps/api)
deploy-api:
	@echo "▶ API (Railway): pushing main — Railway auto-deploys on new commits (Root apps/api, railway.json)"
	git push origin main

## deploy-web: deploy the Next.js web to Vercel production (Root: apps/web; needs `vercel login`)
deploy-web:
	cd apps/web && vercel --prod --yes
