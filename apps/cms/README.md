# @comfyorg/cms

Payload CMS backing the Comfy website. Payload 3 on Postgres, deployed as its own
Next app. `apps/website` will consume it at build time over the REST API; that
integration lands in a follow-up change and no website code reads from it yet.

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

With GCS enabled, the admin browser uploads the file directly to a signed GCS
url (`clientUploads`) rather than through `/api/media` — Vercel rejects request
bodies over 4.5 MB at the edge, and the event videos run 5–25 MB. Minting a
signed write url requires the `admin` role. This needs a one-time CORS rule on
the bucket allowing `PUT` from the CMS origin. `--cors-file` replaces the
bucket's entire CORS config rather than appending to it, so merge the new rule
into whatever the bucket already has:

```bash
gcloud storage buckets describe gs://<GCS_BUCKET> --format='json(cors_config)' \
  | jq '.cors_config // []' > cors.json

jq '. + [{
  "origin": ["https://<cms-domain>"],
  "method": ["PUT"],
  "responseHeader": ["Content-Type"],
  "maxAgeSeconds": 3600
}]' cors.json > cors.merged.json

gcloud storage buckets update gs://<GCS_BUCKET> --cors-file=cors.merged.json
```

Without the CORS rule the browser's `PUT` is blocked and every upload in the
deployed admin panel fails; local dev (no `GCS_BUCKET`) is unaffected.

**Uploading publishes the file immediately.** Media has no draft state: the
moment an asset is uploaded it is downloadable from the CDN and listed by
`GET /api/media`, even while the document using it is still a draft. This
matches how the bucket already works for the website's hand-uploaded assets —
but it means artwork under embargo must not be uploaded before its
announcement.

## Rebuild site

The website is statically built, so published changes only go live on a redeploy.
The admin dashboard's "Rebuild site" button POSTs `/api/rebuild-website`, which
forwards to the Vercel deploy hook in `WEBSITE_DEPLOY_HOOK_URL`. The hook url stays
server-side and the endpoint requires the `admin` role.

## Migrations

The Postgres adapter only pushes schema automatically when `NODE_ENV !== 'production'`,
so production schema comes from the committed migrations in `src/migrations`. The
Vercel build runs `pnpm run ci`, which applies pending migrations before `next build` —
but only when `VERCEL_ENV` is `production`. Preview deploys share the production
`DATABASE_URL`, and Postgres DDL from a branch would outlive the preview (a failed
build or a closed PR doesn't roll it back), so previews build against the schema
production already has.

After changing a collection:

```bash
# 1. Generate against an EMPTY database — diffing against your dev database
#    (already dev-pushed) would emit an empty migration.
docker compose -f apps/cms/docker-compose.yml exec -T postgres \
  psql -U payload -d postgres -c 'CREATE DATABASE payload_migrate;'
DATABASE_URL=postgres://payload:payload@localhost:5433/payload_migrate \
  pnpm --filter @comfyorg/cms migrate:create <name>

# 2. Verify it applies cleanly, then drop the scratch database
DATABASE_URL=postgres://payload:payload@localhost:5433/payload_migrate \
  pnpm --filter @comfyorg/cms migrate
docker compose -f apps/cms/docker-compose.yml exec -T postgres \
  psql -U payload -d postgres -c 'DROP DATABASE payload_migrate;'
```

Keep `GCS_BUCKET` set while generating — the storage plugin adds a `prefix` field
to `media`, and a migration generated without it is missing that column.

## Deploying

Its own Vercel project, root directory `apps/cms`. `vercel.json` pins the
framework preset, the workspace install/build commands, and an `ignoreCommand` so
pushes that don't touch `apps/cms` skip the build. The admin panel is `noindex`.

**Step 1 — before the first deploy — lock the project down.** On a fresh
database `/admin` serves an unauthenticated "create first user" screen, and the
first account is forced to `admin`; an admin can publish content and trigger
production deploys of the website. So the window between first deploy and first
login must not be public: in the Vercel project settings, set Deployment
Protection → Vercel Authentication to **All Deployments** before anything
deploys. After the first deploy, open `/admin` through the protected URL and
create the admin account. Only then relax protection to **Standard Protection**
(previews only) so editors and the website's anonymous content fetch can reach
production.

Environment variables to set on the Vercel project (Production + Preview):

| Key                                                    | Notes                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                         | Supabase **session pooler** URI (port 5432 on `*.pooler.supabase.com`). The direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from Vercel Functions. Preview uses the same database as Production; migrations only run on production deploys (see [Migrations](#migrations)). |
| `PAYLOAD_SECRET`                                       | Fresh `openssl rand -hex 24` — do not reuse the local dev value.                                                                                                                                                                                                                            |
| `GCS_BUCKET`, `GCS_PROJECT_ID`, `GCS_CREDENTIALS_JSON` | Required in production: Vercel's filesystem is read-only, so local-disk media storage cannot work.                                                                                                                                                                                          |
| `GCS_MEDIA_PREFIX`, `GCS_PUBLIC_BASE_URL`              | Optional; defaults are `website/cms` and `https://media.comfy.org`.                                                                                                                                                                                                                         |
| `WEBSITE_DEPLOY_HOOK_URL`                              | Vercel deploy hook on the website project; powers "Rebuild site".                                                                                                                                                                                                                           |
| `WEBSITE_PREVIEW_URL`                                  | Optional; enables the admin "Preview" link.                                                                                                                                                                                                                                                 |

Set the project's Node.js version to **22** — `@types/node` is deliberately
pinned to 22.x to match the deployed runtime rather than taking the workspace
catalog version, so the types can't claim APIs the runtime doesn't have.

Do **not** set `PAYLOAD_ADMIN_EMAIL` / `PAYLOAD_ADMIN_PASSWORD` on Vercel. They only
drive the local login prefill, which requires `NODE_ENV === 'development'` with `VERCEL`
unset — so it stays off on every deployed environment, not just production.

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
