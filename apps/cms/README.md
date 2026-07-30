# @comfyorg/cms

Payload CMS that will back the Comfy website gallery. Blank Payload 3 template on
Postgres, run from the monorepo.

## Start locally

From the repo root:

```bash
# 1. Bring up Postgres
docker compose -f apps/cms/docker-compose.yml up -d

# 2. Create your env file (edit values as needed)
cp apps/cms/.env.example apps/cms/.env

# 3. Start the CMS dev server
pnpm dev:cms
```

Open http://localhost:3000/admin and follow the prompt to create the first admin
user. `DATABASE_URL` and the admin credentials in `.env` match the Postgres service
in `docker-compose.yml`.

## Workspace commands

- `pnpm dev:cms` — dev server (from repo root)
- `pnpm typecheck:cms` — type-check
- `pnpm lint:cms` — lint

`.env` is gitignored; commit changes to `.env.example` instead.

## Formatting

This app formats with **Prettier** (`pnpm --filter @comfyorg/cms format`), not the
repo-wide oxfmt. Payload's `generate:types`/`generate:importmap` emit
Prettier-formatted output, so oxfmt would fight the codegen on every regeneration.
The app is therefore excluded from the root oxfmt and stylelint globs.
