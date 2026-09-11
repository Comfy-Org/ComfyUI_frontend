# @comfyorg/website

Marketing/brand website built with Astro + Vue.

## Ashby careers integration

`/careers` and `/zh-CN/careers` are rendered from Ashby's public job board
API at build time. Data flow:

1. `src/pages/careers.astro` awaits `fetchRolesForBuild()` during the
   Astro build.
2. `src/utils/ashby.ts` calls
   `GET https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=false`,
   validates the envelope and each posting with Zod
   (`src/utils/ashby.schema.ts`), and maps to the domain type in
   `src/data/roles.ts`.
3. On any failure (network, HTTP 4xx/5xx, envelope schema drift),
   the fetcher falls back to the committed JSON snapshot at
   `src/data/ashby-roles.snapshot.json`.
4. `src/utils/ashby.ci.ts` emits GitHub Actions annotations and a
   `$GITHUB_STEP_SUMMARY` block so stale fetches are visible on green
   builds.

### Required environment variables

Both are build-time only. Never prefix with `PUBLIC_` (Astro would
inline that into the client bundle).

| Name                           | Purpose                     | Default (when unset)              |
| ------------------------------ | --------------------------- | --------------------------------- |
| `WEBSITE_ASHBY_API_KEY`        | Ashby API key (Basic auth)  | Build uses the committed snapshot |
| `WEBSITE_ASHBY_JOB_BOARD_NAME` | Ashby public job board slug | Build uses the committed snapshot |

### CI wiring (manual step — required)

This repo's `.github/workflows/*.yaml` changes cannot be pushed by a
GitHub App. A maintainer must apply the following edits **once**:

**`.github/workflows/ci-website-build.yaml`** — pass the env into the
build step:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Setup frontend
        uses: ./.github/actions/setup-frontend

      - name: Build website
        env:
          WEBSITE_ASHBY_API_KEY: ${{ secrets.WEBSITE_ASHBY_API_KEY }}
          WEBSITE_ASHBY_JOB_BOARD_NAME: ${{ vars.WEBSITE_ASHBY_JOB_BOARD_NAME || 'comfy-org' }}
        run: pnpm --filter @comfyorg/website build

      - name: Verify API key is not leaked into build output
        env:
          WEBSITE_ASHBY_API_KEY: ${{ secrets.WEBSITE_ASHBY_API_KEY }}
        run: |
          set +x
          if [ -z "${WEBSITE_ASHBY_API_KEY:-}" ]; then
            echo "Secret not available in this run; skipping leak check."
            exit 0
          fi
          # grep -rlF prints only file paths (never match content).
          MATCHES=$(grep -rlF --exclude-dir=node_modules --null \
            -e "$WEBSITE_ASHBY_API_KEY" apps/website/dist/ 2>/dev/null \
            | tr '\0' '\n' || true)
          if [ -n "$MATCHES" ]; then
            echo "::error title=Ashby API key leaked into build output::$MATCHES"
            exit 1
          fi
```

**`.github/workflows/ci-vercel-website-preview.yaml`** — add the
two env vars to the top-level `env:` block so `vercel build` (both
`deploy-preview` and `deploy-production` jobs) sees them:

```yaml
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_WEBSITE_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_WEBSITE_PROJECT_ID }}
  VERCEL_TOKEN: ${{ secrets.VERCEL_WEBSITE_TOKEN }}
  VERCEL_SCOPE: comfyui
  WEBSITE_ASHBY_API_KEY: ${{ secrets.WEBSITE_ASHBY_API_KEY }}
  WEBSITE_ASHBY_JOB_BOARD_NAME: ${{ vars.WEBSITE_ASHBY_JOB_BOARD_NAME || 'comfy-org' }}
```

The secret must also be added to the Vercel project environment
(`vercel env add WEBSITE_ASHBY_API_KEY …` or via the Vercel UI) so
that `vercel build` in the preview job has access to it.

Fork PRs do not exercise this path: `ci-vercel-website-preview.yaml`
receives an empty `VERCEL_TOKEN` for forks and fails at `vercel pull`
before the build runs. Fork-safe PR interactions (the preview-URL
comment) are handled by `pr-vercel-website-preview.yaml`.

### Refreshing the snapshot

When a maintainer wants to update the committed snapshot (e.g. after
onboarding/offboarding roles):

```bash
WEBSITE_ASHBY_API_KEY=… WEBSITE_ASHBY_JOB_BOARD_NAME=comfy-org \
  pnpm --filter @comfyorg/website ashby:refresh-snapshot
git commit apps/website/src/data/ashby-roles.snapshot.json
```

The script exits non-zero on any non-fresh outcome so stale/empty
snapshots can't be accidentally committed.

## Cloud nodes integration

`/cloud/supported-nodes` (and `/zh-CN/`) lists custom-node packs preinstalled on Comfy Cloud, joined with public metadata from the [ComfyUI Custom Node Registry](https://registry.comfy.org) ([`api.comfy.org`](https://api.comfy.org)). See [`src/components/cloud-nodes/AGENTS.md`](src/components/cloud-nodes/AGENTS.md) for the build pipeline, source-file map, and key invariants.

Build-time env var: `WEBSITE_CLOUD_API_KEY` (Cloud `/api/object_info` auth; the build falls back to the committed snapshot when unset). Must also be set in the Vercel project environment.

### Production strictness

`src/utils/cloudNodes.build.ts` throws when `fetchCloudNodesForBuild()` returns
`{ status: 'stale' }` **and** `process.env.VERCEL_ENV === 'production'`. This
prevents the production deploy from silently shipping an out-of-date snapshot
when the Cloud API is unreachable or `WEBSITE_CLOUD_API_KEY` is missing. Preview
and local builds continue to use the committed snapshot with a warning
annotation.

### Required GitHub Actions / Vercel secrets

| Name                    | Where                                           | Purpose                                                                |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `WEBSITE_CLOUD_API_KEY` | GitHub Actions repo secret + Vercel project env | Auth for Cloud `/api/object_info`. Required for fresh production data. |

The `Release: Website` workflow uses the GitHub Actions secret to regenerate
`apps/website/src/data/cloud-nodes.snapshot.json` via
`.github/actions/cloud-nodes-pull/action.yaml`. The Vercel environment value is
read at build time by `vercel build` in `ci-vercel-website-preview.yaml`; the
`deploy-production` job hard-fails before `vercel build --prod` if the secret
is missing.

### Refreshing the snapshot

To update the committed snapshot manually (e.g. after onboarding new packs
to Comfy Cloud):

```bash
WEBSITE_CLOUD_API_KEY=… \
  pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot
git commit apps/website/src/data/cloud-nodes.snapshot.json
```

The script exits non-zero on any non-fresh outcome so stale/empty snapshots
can't be accidentally committed. Otherwise the `Release: Website` GitHub
Actions workflow runs the same step on every manual dispatch and opens a PR
with the refreshed snapshot.

## Models rollout

Models is included in production and preview builds by default. The boolean
PostHog flag **`workshop-enabled`** controls visibility, independently of the
build and authentication switches. It defaults off, including while flags are
loading, missing, or unavailable. Disabling it restores the public site:

- The header and homepage retain their existing navigation and model links.
- `/models` shows the existing Models marketing page.
- Model render pages show the public marketing content until enabled.
- The catalogue and render pages stay out of sitemaps and markdown exports.

Create `workshop-enabled` in the website's PostHog project with a release
condition targeting only the Comfy staff cohort. Enable that condition for
100% of the cohort and leave everyone else excluded; do not add a general
rollout condition. Expand that audience when ready for the public release.

The website identifies signed-in people with their Firebase UID, matching
Cloud's PostHog identity. Staff can sign in at `/login/` first, then visit
`/models/`. Returning users are identified when their session is restored,
even while the Models entry points are hidden. Account changes and sign-out
clear visibility and reevaluate the flag. No email-domain allowlist is baked
into the frontend.

Vercel CI always builds Models, enables the existing auth and Router execution
switches, and selects production Cloud for production or staging Cloud for
previews. The `workshop` PR label is no longer needed. `workshop-test` only
selects test Cloud; neither label bypasses the PostHog visibility flag.

`WORKSHOP_IN_BUILD=0` remains an explicit build exclusion for diagnostics.
`PUBLIC_WORKSHOP_AUTH_FLAG=1` enables sign-in and
`PUBLIC_WORKSHOP_ROUTER_RUN=1` enables execution; neither grants Models
visibility. For local development without PostHog:

```sh
PUBLIC_WORKSHOP_ENABLED=1 PUBLIC_WORKSHOP_AUTH_FLAG=1 PUBLIC_WORKSHOP_ROUTER_RUN=1 \
  pnpm --filter @comfyorg/website dev
```

`PUBLIC_WORKSHOP_ENABLED` is honored only by the development server. Built
previews and production always use PostHog. This is a frontend visibility
control; the APIs continue to enforce authentication and billing.

### Which Cloud the Workshop talks to

`PUBLIC_WORKSHOP_CLOUD_ENV` picks the backend family. Router, Cloud and the
Firebase project move together, because a token minted in one family is only
valid there:

| Value     | Router                 | Cloud                    | Firebase project  | Who uses it                      |
| --------- | ---------------------- | ------------------------ | ----------------- | -------------------------------- |
| `prod`    | `api.comfy.org`        | `cloud.comfy.org`        | `dreamboothy`     | production                       |
| `staging` | `stagingapi.comfy.org` | `stagingcloud.comfy.org` | `dreamboothy-dev` | previews; local by default       |
| `test`    | `testapi.comfy.org`    | `testcloud.comfy.org`    | `dreamboothy-dev` | previews (`workshop-test` label) |

The backends decide who may call them: ingest's CORS allowlist admits
`comfy.org` only in production and the website's Vercel preview origins only
in staging and test (cloud FE-2009). So a production build must say `prod`, a
preview must say `staging` or `test`, and `workshop-release-gate` fails the
build otherwise — a wrong family is a build error, not a preflight error in a
visitor's browser. Builds with the explicit exclusion are not checked.
Local builds may leave it unset (staging) or pick a family for a specific check.
`test` has no Turnstile
sitekey in this mapping, so the client widget stays off there.

`src/config/workshop-release.ts` owns build inclusion and backend validation.
The `workshop-release-gate` Astro integration registers the Models routes and
always removes the retired `/workshop` output, including in enabled builds.

## HubSpot forms

Pages that collect leads use HubSpot's hosted form embed:

```html
<script
  src="https://js-na2.hsforms.net/forms/embed/developer/244637579.js"
  defer
></script>
<div
  class="hs-form-html"
  data-region="na2"
  data-form-id="94e05eab-1373-47f7-ab5e-d84f9e6aa262"
  data-portal-id="244637579"
></div>
```

Every form lives under portal `244637579` in region `na2` and is addressed by
form ID:

| Page                                    | Form ID                                |
| --------------------------------------- | -------------------------------------- |
| `/contact`                              | `94e05eab-1373-47f7-ab5e-d84f9e6aa262` |
| `/zh-CN/contact`                        | `6885750c-02ef-4aa2-ba0d-213be9cccf93` |
| `/minimax/license/professional-request` | `40ef858c-374a-4958-8180-bfa54f0a67fb` |

This keeps submission handling, validation, anti-spam updates, and field
configuration in HubSpot. The local implementation in
`src/components/common/HubspotFormEmbed.vue` takes the form ID as a prop, loads
the hosted script once, and renders the documented embed container.

## Scripts

- `pnpm dev` — Astro dev server
- `pnpm build` — production build to `dist/`
- `pnpm typecheck` — `astro check`
- `pnpm test:unit` — Vitest unit tests
- `pnpm test:e2e` — Playwright E2E tests (requires `pnpm build` first)
- `pnpm ashby:refresh-snapshot` — refresh the committed careers snapshot
- `pnpm cloud-nodes:refresh-snapshot` — refresh the committed cloud nodes snapshot
