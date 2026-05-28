.DEFAULT_GOAL := help
.PHONY: help install generate db-push db-migrate db-deploy db-studio dev dev-web dev-api build lint test clean

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
