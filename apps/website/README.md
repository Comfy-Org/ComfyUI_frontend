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
build step and run the unit tests before it:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Setup frontend
        uses: ./.github/actions/setup-frontend

      - name: Run website unit tests
        run: pnpm --filter @comfyorg/website test:unit

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

`/cloud/nodes` and `/zh-CN/cloud/nodes` are rendered from the Comfy
Cloud `/api/object_info` endpoint at build time, joined with public
metadata from `https://api.comfy.org/nodes`. Data flow:

1. `src/pages/cloud/nodes.astro` awaits `fetchCloudNodesForBuild()`
   during the Astro build.
2. `src/utils/cloudNodes.ts` calls
   `GET https://cloud.comfy.org/api/object_info` with the
   `X-API-Key: $WEBSITE_CLOUD_API_KEY` header, validates the envelope
   and each node with Zod via `@comfyorg/object-info-parser`, and
   sanitizes user content (combo lists referencing user filenames are
   stripped; combo options on `LoadImage`/`LoadImageMask`/
   `LoadImageOutput`/`LoadVideo`/`LoadAudio` are zeroed out entirely).
3. Pack ids are derived from `python_module` and enriched with public
   registry metadata via `src/utils/cloudNodes.registry.ts` (no auth,
   batches of 50, single retry; soft failure when registry is
   unreachable).
4. On any failure (network, HTTP 4xx/5xx, envelope schema drift), the
   fetcher falls back to the committed JSON snapshot at
   `src/data/cloud-nodes.snapshot.json`. The snapshot is the source of
   truth for contributors without a key.
5. `src/utils/cloudNodes.ci.ts` emits GitHub Actions annotations and a
   `$GITHUB_STEP_SUMMARY` block so stale fetches are visible on green
   builds.

### Required environment variables

Build-time only. Never prefix with `PUBLIC_` (Astro would inline that
into the client bundle).

| Name                    | Purpose                       | Default (when unset)              |
| ----------------------- | ----------------------------- | --------------------------------- |
| `WEBSITE_CLOUD_API_KEY` | Cloud `/api/object_info` auth | Build uses the committed snapshot |

### CI wiring

```yaml
jobs:
  build:
    steps:
      - name: Build website
        env:
          WEBSITE_CLOUD_API_KEY: ${{ secrets.WEBSITE_CLOUD_API_KEY }}
        run: pnpm --filter @comfyorg/website build

      - name: Verify cloud API key is not leaked into build output
        env:
          WEBSITE_CLOUD_API_KEY: ${{ secrets.WEBSITE_CLOUD_API_KEY }}
        run: |
          set +x
          if [ -z "${WEBSITE_CLOUD_API_KEY:-}" ]; then
            echo "Secret not available in this run; skipping leak check."
            exit 0
          fi
          MATCHES=$(grep -rlF --exclude-dir=node_modules --null \
            -e "$WEBSITE_CLOUD_API_KEY" apps/website/dist/ 2>/dev/null \
            | tr '\0' '\n' || true)
          if [ -n "$MATCHES" ]; then
            echo "::error title=Cloud API key leaked into build output::$MATCHES"
            exit 1
          fi
```

The Vercel preview workflow (`ci-vercel-website-preview.yaml`) needs
`WEBSITE_CLOUD_API_KEY` in both `deploy-preview` and `deploy-production`
build steps so `vercel build` can read it. The secret must also exist
in the Vercel project environment.

### Refreshing the snapshot

```bash
WEBSITE_CLOUD_API_KEY=… \
  pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot
git commit apps/website/src/data/cloud-nodes.snapshot.json
```

The script writes atomically (`.tmp` then rename), exits non-zero if
the outcome is anything other than `fresh`, and runs a final regex
sweep that fails if any committed combo value matches a user-content
filename pattern (PNG/JPEG/MP4/SAFETENSORS/etc.).

### Sanitization

The cloud `object_info` endpoint mixes the calling user's uploaded
files into combo input lists. `sanitizeUserContent()` runs on every
fetched response and on the snapshot before it is written:

- Combo values matching `/\.(png|jpe?g|webp|gif|mp4|mov|webm|wav|mp3|flac|ogg|safetensors|ckpt|pt)$/i`
  are dropped from any node.
- Combo lists for known user-upload nodes (`LoadImage`,
  `LoadImageMask`, `LoadImageOutput`, `LoadVideo`, `LoadAudio`) are
  emptied entirely.

Tests in `packages/object-info-parser/src/__tests__/sanitizeUserContent.test.ts`
exercise both paths.

## HubSpot contact form

The contact page uses HubSpot's hosted form embed for the interest form:

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

The localized `/zh-CN/contact` page uses the same portal and script with form
ID `6885750c-02ef-4aa2-ba0d-213be9cccf93`.

This keeps submission handling, validation, anti-spam updates, and field
configuration in HubSpot. The local implementation in
`src/components/contact/HubspotFormEmbed.vue` only loads the hosted script and
renders the documented embed container.

## Scripts

- `pnpm dev` — Astro dev server
- `pnpm build` — production build to `dist/`
- `pnpm typecheck` — `astro check`
- `pnpm test:unit` — Vitest unit tests
- `pnpm test:e2e` — Playwright E2E tests (requires `pnpm build` first)
- `pnpm ashby:refresh-snapshot` — refresh the committed careers snapshot
- `pnpm cloud-nodes:refresh-snapshot` — refresh the committed cloud nodes snapshot
