# @comfyorg/cms

Payload CMS backing the Comfy website. Payload 3 on Postgres, deployed as its own
Next app and consumed by `apps/website` at build time over the REST API.

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
user. `DATABASE_URL` in `.env` matches the Postgres service in
`docker-compose.yml`.

## Collections

- **Gallery** and **Events** — the published content the website builds from.
  Both are draft-enabled: the admin "Preview" link renders drafts against
  `WEBSITE_PREVIEW_URL`, and only published docs reach a production build.
- **Media** — uploads, with `alt` localized per locale.
- **Creators**, **Teams**, **Tools** — name-only relationship targets for gallery
  items.
- **Users** — every user carries a `role`. `admin` is the only role that can
  create, update, or delete content, manage users, or reach the admin panel.
  `website-preview` exists so the preview deployment can be issued an API key
  for authenticated draft reads and nothing else, and it is the default for new
  accounts — promote to `admin` deliberately. The one exception is the very
  first user, which is forced to `admin` so a fresh install has someone who can
  log in. Email/password login is unchanged.

Locales are `en` (default) and `zh-CN`; a missing zh-CN value falls back to en.

## Media storage

Uploads land on the Next server's local disk unless `GCS_BUCKET` is set. With the
GCS vars configured, uploads go to the bucket behind the `media.comfy.org` CDN and
each media doc's `url` becomes an absolute CDN url. See `.env.example`.

## Rebuild site

The website is statically built, so published changes only go live on a redeploy.
The admin dashboard's "Rebuild site" button POSTs `/api/rebuild-website`, which
forwards to the Vercel deploy hook in `WEBSITE_DEPLOY_HOOK_URL`. The hook url stays
server-side and the endpoint requires the `admin` role.

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
