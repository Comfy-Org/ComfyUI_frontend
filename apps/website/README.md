# @comfyorg/website

Marketing/brand website built with Astro + Vue.

## Linting

From the repository root, `pnpm lint` checks website Astro, JavaScript,
TypeScript, and Vue files along with the rest of the repository, and
`pnpm lint:fix` applies automatic fixes. To lint only this folder, run
`pnpm exec eslint apps/website`. Astro uses the recommended Astro ESLint rules
and the shared Tailwind rules with the website's theme.

The shared lint CI runs `pnpm lint` on pull requests and in the merge queue.
Pre-commit checks staged Astro files with ESLint and runs the website
typecheck. `astro check` remains part of
`pnpm typecheck:website` for compiler and type diagnostics.

## Model-page generation tests

See [MODEL_TESTING.md](MODEL_TESTING.md) for setup, maximum account concurrency,
parallel image/audio/video sweeps, targeted retests and result commits.
[MODELS_TEST_RESULTS.md](MODELS_TEST_RESULTS.md) records every published page's
latest check and last successful generation.

## Formatting

Run `pnpm format:astro` from the repository root to format Astro files, or
`pnpm format:astro:check` to check them. Both are included in the root format
commands and shared CI checks. Pre-commit formats staged Astro files after
ESLint fixes.

Astro files use Prettier with the official Astro plugin; other formats continue
to use Oxfmt. The website's `.prettierrc.json` matches the repository's style
and preserves whitespace around inline HTML elements. The Astro editor
extension also reads this configuration.

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

Note that an absent key is not an error anywhere, including production — the
build falls back to the committed snapshot and `src/utils/ashby.ci.ts` emits a
CI warning, so a careers page frozen at whatever the snapshot last held looks
like a green deploy. The cloud-nodes equivalent does hard-fail production
(`ci-vercel-website-preview.yaml`, `Verify WEBSITE_CLOUD_API_KEY`); adding the
same gate here is worthwhile once someone has confirmed both values are set as
Actions **secrets** rather than repo variables.

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
          WEBSITE_ASHBY_JOB_BOARD_NAME: ${{ secrets.WEBSITE_ASHBY_JOB_BOARD_NAME }}
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
  WEBSITE_ASHBY_JOB_BOARD_NAME: ${{ secrets.WEBSITE_ASHBY_JOB_BOARD_NAME }}
```

The secret must also be added to the Vercel project environment
(`vercel env add WEBSITE_ASHBY_API_KEY …` or via the Vercel UI) so
that `vercel build` in the preview job has access to it.

Fork PRs do not exercise this path: `ci-vercel-website-preview.yaml`
receives an empty `VERCEL_TOKEN` for forks and fails at `vercel pull`
before the build runs. Fork-safe PR interactions (the preview-URL
comment) are handled by `pr-vercel-website-preview.yaml`.

### Keeping the careers page current

A role edited in Ashby appears on comfy.org only once a production deploy runs,
because the page is rendered at build time. Any push to `main` touching
`apps/website/**` produces one (see `ci-vercel-website-preview.yaml`), and each
rebuild re-fetches Ashby live — so during normal development the live page
tracks Ashby on its own.

What does not keep up is the committed snapshot, which is what fork CI builds,
local dev, and any build where Ashby is unreachable or the key is missing
render from. Same-repo Vercel previews are not in that list — they get the key
and fetch live, same as production. Refreshing the snapshot is the
`Release: Website` workflow's job: it regenerates both snapshots and opens a
PR, and merging the PR also triggers a production deploy — which is what makes
it useful during a quiet week with no other website commits.

It has one trigger, `workflow_dispatch`, reached two ways:

| `inputs.source` | Dispatched by                                |
| --------------- | -------------------------------------------- |
| `manual`        | A maintainer clicking **Run workflow**       |
| `ashby-webhook` | The `comfy-router` Worker, on an Ashby event |

There is deliberately no `schedule`. A periodic refresh was considered and
dropped: the live page already tracks Ashby through ordinary deploys (256 in
one five-week sample), so a cron would only be maintaining the fallback file,
and it would do so by opening PRs nobody asked for. The webhook covers the
case the deploy stream does not — an Ashby change during a quiet week.

The webhook receiver lives in [`Comfy-Org/comfy-router`](https://github.com/Comfy-Org/comfy-router)
(`src/ashby-webhook.js`), which serves `https://comfy.org/api/webhooks/ashby`.
Ashby cannot call GitHub directly: the dispatch endpoint needs a GitHub-shaped
body Ashby does not send, and it would put a release-capable credential in an
ATS setting. So the Worker verifies Ashby's signature and calls this workflow's
dispatch endpoint. See that repo's `docs/ashby-webhook.md` for setup and key
rotation.

A run only opens a PR when the underlying data actually changed; see
"Refreshing the snapshot" below.

### Refreshing the snapshot

When a maintainer wants to update the committed snapshot (e.g. after
onboarding/offboarding roles):

```bash
WEBSITE_ASHBY_API_KEY=… WEBSITE_ASHBY_JOB_BOARD_NAME=comfy-org \
  pnpm --filter @comfyorg/website ashby:refresh-snapshot
git commit apps/website/src/data/ashby-roles.snapshot.json
```

The script exits non-zero on any non-fresh outcome, so a failed fetch cannot
be committed as data. It also refuses to write when **all three** hold: Ashby
returned zero usable roles, at least one posting was dropped in validation,
and the committed snapshot is non-empty. That combination is a schema
mismatch — every posting failing validation is otherwise reported as a
successful fetch of zero roles, which would empty the careers page. A
genuinely empty board drops nothing and is allowed through.

The guard is all-or-nothing: 9 of 10 postings failing still leaves one role
and writes. Partial drops are surfaced as CI warnings by
`src/utils/ashby.ci.ts` rather than blocked.

Both guards decide what a refresh would cost by reading the committed
snapshot, so a snapshot that exists but cannot be parsed generally aborts the
refresh rather than being silently replaced — otherwise the guard would see
"no baseline" and wave through exactly the data it exists to catch. There is
one exception, in the table below. A missing file is still fine; that is a
first run.

The two guards differ in when they read it, so an unparseable snapshot does
not behave the same way on both sides:

| Committed snapshot            | Cloud-nodes refresh                                                  | Ashby refresh                        |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Absent                        | Writes (first run — no baseline, so a degraded fetch is written too) | Writes (first run)                   |
| Valid                         | Guard applies                                                        | Guard applies                        |
| Unparseable, fetch degraded   | Aborts                                                               | Aborts                               |
| Unparseable, fetch healthy    | Aborts                                                               | **Overwrites it with the good data** |
| Unreadable (permissions, I/O) | Aborts                                                               | Aborts                               |

The cloud-nodes guard reads the snapshot unconditionally, so it aborts on
anything it cannot parse. The Ashby guard reads it only once the fetch already
looks like a schema break (zero usable roles, at least one dropped), because
that is the only case where the baseline changes the answer. On a healthy
fetch it never looks, and `writeSnapshotIfChanged` replaces the corrupt file —
which is the outcome you want, and what `snapshot-writer.test.ts` asserts.

Note the last row is not the same thing. Unparseable means the bytes are
there and are not a JSON object — malformed JSON, or a valid array or scalar,
all three of which `snapshot-writer.test.ts` covers. Unreadable means the read
itself failed. Only ENOENT is treated as "no snapshot yet", so a permissions
error or a directory in the file's place aborts every refresh, including a
healthy one. Neither script repairs that for you.

`refresh-cloud-nodes-snapshot.ts` has the equivalent guard for packs that lose
their registry metadata, tolerating up to two — a delisted pack is a real
thing, a registry outage strips dozens at once. If a larger loss is genuine,
re-run it locally with the override and commit the result to `main`:

```sh
WEBSITE_ALLOW_REGISTRY_LOSS=1 WEBSITE_CLOUD_API_KEY=… \
  pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot
```

Close any open refresh PR first. While one is open the workflow takes its
baseline from that branch, not from `main`, so a fix committed only to `main`
would not clear the guard.

Each refresh stamps a fresh `fetchedAt`, so `scripts/snapshot-writer.ts` leaves
the file untouched when that timestamp is the only thing that moved. Without
that, every webhook run would open a PR whose whole diff is a timestamp.

The cloud-nodes snapshot needs the same treatment for `downloads` and
`githubStars`, which the registry moves continuously — across two real
snapshot commits 10 days apart, 106 of 179 changed lines were those two
counters alone. `refresh-cloud-nodes-snapshot.ts` passes them as volatile so
they never by themselves open a PR; they are still written, with current
values, whenever something substantive changes.

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
Actions workflow runs the same step on the Ashby webhook and on manual
dispatch, opening a PR only when the refreshed data differs from what is
already proposed. See "Keeping the careers page current" above.

Note that this snapshot therefore refreshes on an Ashby event, which has
nothing to do with cloud nodes. The coupling is harmless — production fetches
the Cloud API live on every build, so only the fallback is involved — but if
this snapshot ever needs refreshing on its own cadence, dispatch the workflow
or run the script above.

## Hub sections

The hub has one page per section, linked by the catalogue tabs: `/hub/models/`,
`/hub/workflows/` and `/hub/apps/`. The workflows and apps pages show the
showcase until their flag is on, and stay noindex: `/hub/workflows/` lifts with
`launchedWorkflowPages`, `/hub/apps/` has no switch yet. Being noindex, neither
has a markdown twin. Old `/hub/models/?type=workflows` and `?type=apps` links
replace themselves with the section page in the browser, keeping the other
query parameters.

## Hub workflows routing

The website builds the workflow pages listed in `src/config/hub-workflow-names.json` at `/hub/workflows/<name>/`. It publishes `/hub/workflows/manifest.json` (`{ version, defaultOwner, pages, legacyRedirects }`), which comfy-router reads to decide who answers each `/hub/workflows/*` URL. The build validates the manifest and fails if it is invalid.

The router (comfy-router#46) fetches the manifest from the website origin directly, not through comfy.org, so it never depends on its own routing to reach it. It also passes the public `comfy.org/hub/workflows/manifest.json` path straight through to the website, even though `manifest.json` is not in `pages`.

To move more workflows onto the website:

1. Add the pages; `hub-workflow-names.test.ts` fails until you refresh the list with `vitest -u`. The router picks up the new `pages` from the live manifest on the next website deploy.
2. To redirect an old `/workflows/<slug>/` URL, list it in `legacyRedirects` in `src/config/hub-workflows-routing.ts` (exact paths only, each pointing at a page in the list), then copy the same entry into the router's bundled `src/hub-workflow-manifest.js` and redeploy the router. The router reads only its bundled copy for `/workflows/*`, so the website's entry alone redirects nothing.
3. Once every workflow has moved, flip `defaultOwner` to `website`. This one is data only: it affects `/hub/workflows/*`, which reads the live manifest.

The website itself never redirects `/workflows/*`; the router does.

## Models rollout

Models is included in production and preview builds by default. The boolean
PostHog flag **`workshop-enabled`** controls visibility, independently of the
build and authentication switches. It defaults off, including while flags are
loading, missing, or unavailable, except that an identity PostHog has already
answered for is seeded from the persisted answer before the refresh, so an
enabled staff member never sees the public page while flags reload. A failed
refresh preserves the last confirmed answer for the same identity; a new
identity never inherits a grant. Disabling it restores the public site:

- The header and homepage retain their existing navigation and model links.
- `/models` shows the existing Models marketing page.
- Model render pages show the public marketing content until enabled.
- Catalogue and playground markup is absent from public HTML; their components
  and page data load after enablement. Homepage islands still serialize public
  model and provider summaries. `/models` remains indexable with its marketing content.
- Render pages stay out of sitemaps and markdown exports. `/models/showcase`
  is the unlisted public copy of the marketing page: noindex and out of the
  sitemap.
- Once enabled, a neutral loading frame replaces the public content while a
  page's data loads, and a failed load shows a retry; the public page only ever
  renders when the flag is off.

Create `workshop-enabled` in the website's PostHog project with two release
condition groups: `comfy_staff` equal to `true` at 100%, and all users initially
at 0%. PostHog combines the groups with OR. Raise only the all-users percentage
to ramp external visitors independently from 0% to 100%; staff remain enabled
through the first group. Do not target the email-based staff cohort: the
frontend PII scrubber strips `email` from everything it sends, so people who
sign in through the website never join that cohort.

The website identifies signed-in people with their Firebase UID, matching
Cloud's PostHog identity. For a verified `comfy.org` or `drip.art` email it
also sets `comfy_staff: true`; every other account sends nothing beyond the
UID. Give staff `/login/?returnTo=%2Fmodels%2F` so they can sign in before
their Models flag is evaluated. Anyone who signed in before `comfy_staff`
existed must sign out and back in once. Authentication is available before
PostHog answers, including when flags are missing or unavailable; no separate
auth flag needs to be created or enabled. The legacy `workshop-auth`
flag can still disable authentication explicitly with a `false` answer.
The public header deliberately has no new sign-in entry point.
Returning users retain access when Firebase confirms the same PostHog identity.
Account changes and sign-out clear visibility and reevaluate the flag. Firebase
starts only on auth pages or after Models becomes visible.

Visibility revocation hides the page, closes its dialogs, and blocks new runs,
while a render already in progress finishes and reports its outcome. Sign-out,
workspace changes, and leaving the page still cancel the browser's wait.

Vercel CI always builds Models and enables Router execution, selecting production
Cloud for production or staging Cloud for previews. The auth build override
applies only outside production. The `workshop` PR label is no longer needed.
`workshop-test` only selects test Cloud; neither label bypasses the PostHog
visibility flag.

`WORKSHOP_IN_BUILD=0` turns Workshop off: Run, the Models nav tab and the account
menu stay hidden whatever the PostHog flag says. Except the four noindex
checkout pages, it never removes or replaces a page; every Models page keeps its
URL and content.
`PUBLIC_WORKSHOP_AUTH_FLAG=1` overrides a remote auth disable outside production.
`PUBLIC_WORKSHOP_ROUTER_RUN=1` enables execution; neither grants Models visibility.
For local development without PostHog:

```sh
PUBLIC_WORKSHOP_ENABLED=1 PUBLIC_WORKSHOP_AUTH_FLAG=1 PUBLIC_WORKSHOP_ROUTER_RUN=1 \
  pnpm --filter @comfyorg/website dev
```

`PUBLIC_WORKSHOP_ENABLED` is honored only by a local `astro dev` command. Built
previews and production always use PostHog. This is a frontend visibility
control; the APIs continue to enforce authentication and billing.

### Cloud workflow pages

`workshop-display.json` owns the page and INPUT widgets. The matching record in
`workshop-workflows.jsonl` supplies the prepared execution graph, input mappings,
defaults and selected outputs. Add both records when introducing a workflow;
unmatched entries stay hidden. Prepare metadata offline when content changes.
The website does not extract editor APP selections or execute widget serializers.

Workflow pages reuse the Models form, validation and output components. The
`workshop-workflows-enabled` PostHog flag gates new visits and runs. A caller's
saved run remains recoverable after that flag is disabled; sign-out or workspace
switching detaches its controller and hides its results. Backend authorization and
admission controls remain authoritative. Local development also accepts
`PUBLIC_WORKSHOP_WORKFLOWS_ENABLED=1`.

Workshop apps (Cinematic Studio and Re-shoot) are gated separately by the
`workshop-apps-enabled` PostHog flag: their pages at `/hub/apps/<slug>/`, the
`/hub/apps/` page and its tab, the featured slide on `/hub/models/` and a model
page's Open in Studio link. `/cinematic-studio` and the old
`/models/apps/<slug>/` addresses redirect to the app pages. The built apps are
listed in `src/config/hub-app-names.json`; `hub-app-names.test.ts` fails until
you add or remove the app there too. Local development also accepts
`PUBLIC_WORKSHOP_APPS_ENABLED=1`.

`src/config/workflow-render.ts` implements the shared workflow request and polling
helper. Node scripts import `workflow_render` and `workflow_for_model` from
`scripts/workflow-render.ts`; `COMFY_API_KEY` supplies the credential unless a
token option is given. File inputs use the form's `{ file, name, size, type }`
shape and are uploaded through Cloud's existing `/api/inputs/upload-url` grant
and raw PUT. HTTPS inputs are downloaded within the file limit, then uploaded
the same way; browser URL inputs require source CORS permission. The returned
asset name is mapped into the prepared graph for `POST /api/prompt`.

Persist `onAdmitted`'s job ID and resume with `{ runId }`. Do not automatically
retry an uncertain submission: the existing prompt endpoint does not promise
idempotency. Aborting the helper stops observation. Explicit cancel calls the
job-scoped endpoint and is presented as requested, without claiming confirmed
execution shutdown. Polling `/api/jobs/{id}?short_link=ephemeral_tool_chain`
returns temporary output links; rereading that job refreshes delivery without
submitting inference. The API tab shows the native request and upload steps.

Prepare graph previews separately with
`pnpm --filter @comfyorg/website exec tsx scripts/prepare-workflow-previews.ts`.
This reads `source.uiWorkflowPath` at the pinned commit from the local checkout
and writes static SVG plus original workflow JSON into
`public/workflow-graphs/`. `source.path` identifies the executable API graph;
the UI workflow path is declared separately in the same JSONL record. New source
repositories require offline preparation; neither the website build nor run
admission invokes this tool.

The shared helper completed a real production background-removal run through
upload, generation and PNG download on 2026-09-23. Staging browser execution,
the other prepared workflows and caller billing still need acceptance checks.
Additional backend infrastructure is deferred and requires Cloud team agreement.

### Models analytics

Product analytics use the website's existing PostHog project, following the
[telemetry routing policy](../../docs/adr/TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md).
Hex/Snowflake remains the downstream warehouse analysis layer.

All event names below have the prefix `website:workshop_`:

| Event                     | When it fires                                                                  |
| ------------------------- | ------------------------------------------------------------------------------ |
| `catalogue_viewed`        | Once per page mount, after the catalogue becomes visible.                      |
| `model_viewed`            | Once per page mount, after a model page becomes visible.                       |
| `api_viewed`              | The user opens a model's API tab.                                              |
| `run_validation_failed`   | Local form validation rejects a Run action.                                    |
| `run_started`             | A validated Run action begins, including uploads and credential refresh.       |
| `run_finished`            | The attempt succeeds, fails, or is cancelled, with `status` and `duration_ms`. |
| `checkout_failed`         | A top-up attempt fails during balance, credential, or checkout setup.          |
| `output_download_clicked` | The user requests an output download.                                          |

The basic funnel is catalogue view → model view → run started → run finished
with `status=succeeded` → output download clicked. Model events include slug,
Router ID, provider, and modality. Run events also retain the initiating
`user_id`, `workspace_id`, and a unique `attempt_id` across their start and
finish. Finished requests include `request_id` when available; success counts
returned artifacts, and failures include a bounded reason plus allowlisted HTTP
status and Router error type when available. Checkout failures include their
stage and bounded SDK error code, plus a real HTTP status when one exists.

Retries get new attempt IDs even when they reuse a Router idempotency key.
Cancellation describes the browser stopping its wait, not a billing outcome.
Downloads measure clicks, not completed transfers. These events contain no
prompts, form values, filenames, media URLs, output contents, or credentials.

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

## Search indexing

Only the production build (`VERCEL_ENV=production`) can be indexed. Every
other build (local, CI, Vercel previews) puts
`<meta name="robots" content="noindex, nofollow">` on every page, so a copy of
the site never competes with comfy.org. Those builds also drop the canonical
link and hreflang alternates, so a preview never points its noindex at
comfy.org. `WEBSITE_INDEXABLE=1` gives a build outside Vercel the production
head; `pnpm build:e2e` sets it for the e2e and screenshot builds. Pages that are
noindex on their own stay noindex either way.

The decision is baked into the HTML at build time, so never use Vercel's
Promote to Production on a preview deployment: it would serve
`noindex, nofollow` on comfy.org. The `deploy-production` job fails if its
build has a robots meta on `/`, and `CI: Website Build` fails if a
non-production build doesn't.

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
- `pnpm build:e2e` — indexable build to `dist/`, the one e2e and screenshots run against
- `pnpm typecheck` — `astro check`
- `pnpm test:unit` — Vitest unit tests
- `pnpm test:e2e` — Playwright E2E tests (requires `pnpm build:e2e` first)
- `pnpm ashby:refresh-snapshot` — refresh the committed careers snapshot
- `pnpm cloud-nodes:refresh-snapshot` — refresh the committed cloud nodes snapshot
