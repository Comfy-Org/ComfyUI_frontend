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

Run `pnpm --filter @comfyorg/website format` from the repository root to format
the website, or `pnpm --filter @comfyorg/website format:check` to check it. CI
runs every workspace's format check with
`pnpm -r --include-workspace-root format:check`. Pre-commit formats staged
Astro files after ESLint fixes.

Astro files use Prettier with the official Astro plugin; other formats continue
to use Oxfmt. The website's `.prettierrc.json` matches the repository's style
and preserves whitespace around inline HTML elements. The Astro editor
extension also reads this configuration.

## Localization

The site ships English, Simplified Chinese (`zh-CN`) and Japanese (`ja`).
Catalogs live in `src/locales/<locale>/*.json` in the same nested JSON layout
and [vue-i18n message syntax](https://vue-i18n.intlify.dev/guide/essentials/syntax)
as the application's `src/locales/` at the repository root:

- Named placeholders: `"Show {n} models"`, filled with
  `t('workshop.search.show', { n }, { locale })`.
- Plural forms separated by `|`: `"{count} node | {count} nodes"`, picked with
  `t('cloudNodesLaunch.models.nodeCount', { count }, { locale, plural: count })`.
- The characters `{`, `}`, `@` and `|` are message syntax, so literal ones are
  written as `{'{'}`, `{'}'}`, `{'@'}` and `{'|'}`.

`src/i18n/translations.ts` configures vue-i18n and exports its public translation
API. Astro middleware binds `Astro.locals.t` to the request locale. In Vue and
TypeScript, bind once with `translationsFor(locale).t`; each locale has its own
composer because the site renders locales concurrently. Missing messages fall
back to English. The catalog test compiles every message and checks that each
eligible English message has Chinese copy.

`main.json` is the catalog for each locale. Keep feature copy grouped under a
nested feature key.

Add new English copy to the English catalog; translated copy lives in the
matching file under each locale. Every eligible English message requires a
Chinese entry. Excluded namespaces use English fallback when no translation
exists. The catalog tests enforce this distinction.
Catalog files use two-space JSON indentation and a final newline. Legal and
content pages render their sections in the order they appear in the catalog, so
keep `en/main.json` in document order and never sort its keys.

### Excluded and English-only copy

`src/config/translation.ts` owns the website's language guidance, glossary and
generation exclusions, and derives target locales from the locale registry in
`src/config/locales.ts`. Generation never machine-translates these excluded
namespaces: `tos`, `enterprise-msa`, `privacy`, `desktop_privacy`,
`affiliate-terms` and `minimaxLicense`.

Exclusion controls translation only. Route availability is a separate policy,
recorded in the page headers and `LOCALE_INVARIANT_ROUTE_KEYS`:

- Affiliate terms, Terms of Service (`tos`) and the Enterprise MSA are
  legal-reviewed English documents on English-only routes. Their untranslated
  Chinese entries are absent, so fallback renders the current English. The two
  translated affiliate page labels remain.
- Desktop privacy (`desktop_privacy`) keeps its `/zh-CN/privacy/desktop` route,
  which renders the governing English document through fallback.
- The Privacy Policy (`privacy`) keeps its translated `/zh-CN/privacy-policy`
  route. Generation never refreshes that Chinese copy; people maintain it.
- The whole `minimaxLicense` namespace is excluded. This covers the entire
  localized `/zh-CN/minimax/license` page, including its marketing copy, not
  only the professional-request intake that embeds an English-only HubSpot
  form. New copy on that page renders English until someone translates it.

Do not translate or publish localized legal documents until legal approves
them; an unreviewed translation can diverge from the governing English text.

The reverse also holds: eligible namespaces are translated even when their page
has no localized route. Japanese catalogs therefore contain copy for pages that
have no `/ja/` route yet. Generation never enables routes or indexing.

### Generating translations

Inside this package, run `pnpm locale:check` for an offline preflight, or
`pnpm locale` with `OPENAI_API_KEY` to translate eligible missing or changed
copy. Both scripts call the shared CLI in `scripts/i18n/update-locales.ts` with
`--target website`. From the repository root, run
`pnpm --filter @comfyorg/website locale:check` or
`pnpm --filter @comfyorg/website locale`.

### Publication baselines

Each generation records what it published in
`src/locales/.source-manifest.json` (version 3). For each catalog file it
holds:

- `files["main.json"].source`: a fingerprint for every English leaf as last
  published.
- `files["main.json"].locales["<locale>"].fingerprints`: a fingerprint for
  every value in that locale catalog as last published.
- `files["main.json"].locales["<locale>"].reviewNeeded` and
  `files["main.json"].knownViolations`, described below.

A fingerprint map is keyed by the JSON key-segment array, so
`privacy.intro.title` appears as `["privacy","intro","title"]`. Each value is
the SHA-256 hex digest of `JSON.stringify(value)`. An array counts as one
value. The digests exist only for comparison. They are not Git object IDs,
and the commands read no Git history. A matching fingerprint proves only that
a value equals what generation last wrote, not that a person approved it.

Generation writes the catalogs and manifest in one publication, so every
commit tree carries its own baseline. The record survives edits made after
generation and squash merges. The manifest stores no copy of the previous
English or translations; read old wording from version control. If the
manifest fails validation, both `locale:check` and `pnpm locale` fail; restore
it from version control.

Generation compares fingerprints of the current catalogs with the recorded
ones:

- While English is unchanged, existing copy stays, including intentional empty
  strings.
- A new English key keeps a translation supplied in the same change.
- When English changes and an eligible translation still matches its recorded
  fingerprint, generation replaces it.
- When English changes and the translation was edited, generation keeps the
  edit and flags it `REVIEW NEEDED`. Fingerprints show content, not the order
  of edits, so they cannot show that the edit was written against the new
  English.
- When English changes under an excluded namespace, generation keeps the
  translation and flags it `REVIEW NEEDED`.
- Deleting an eligible locale value requests a new translation.
- Deleting an English key removes its locale values, fingerprints and review
  flags. Deleting an English file removes its locale catalogs and manifest
  entry.

Excluded values that are missing, or nonempty and equal to the current or
previous English, are removed so the page uses current English fallback. An
intentional empty string stays.

### Review flags

`reviewNeeded` lists key-segment arrays: `privacy.intro.block.0` appears as
`["privacy","intro","block","0"]`. Both commands print each flag starting with
`REVIEW NEEDED: <locale>/main.json: <dotted path>`. Flags are warnings and never
fail CI. A flag persists across runs, including after its namespace leaves the
exclusion list. To accept the wording after generation, either edit the locale
value or delete that exact entry from `reviewNeeded`.

Flagged copy in an eligible namespace is still audited against current English;
a violation fails the check. Flagged copy in an excluded namespace skips the
token audit, and its `knownViolations` entries carry forward unchanged until a
person clears the flag. Invalid retained copy fails preflight before any paid
request; fix or delete that value first.

### Validation and baselines

Website validation is strict. A translated plural message keeps the English
form count or collapses to one form. With the same count, each form must keep
the placeholders and markup of the matching English form. A collapsed form must
keep every token at the highest count any English form uses. Markup must be
balanced; tag order may change.

Generated copy must keep every link URL exactly as written in English, and the
validator rejects any change. Authored copy may prefix an internal `href` with
the exact target locale, such as `/zh-CN/pricing/`. The validator does not check
that the prefixed route exists, so review those links against the available
routes.

`files["main.json"].knownViolations` lists accepted violations as
`{ "locale", "path", "code", "token" }`, where `path` is a key-segment array and
`code` is one of `violationCodes` in `scripts/i18n/protected-tokens.ts`. A
violation that matches an entry passes; any other violation fails. Entries
that no longer match a violation are printed as
`STALE BASELINE: <locale>/main.json: <dotted path>: <description>` and counted
in the summary without failing. Each successful generation rewrites the list
with the entries its output still matches, plus deferred entries under excluded
flagged paths. No command adds entries.

### Interrupted generation

Generation publishes through a recovery journal,
`src/locales/.locale-publication.json`, which lists each catalog and manifest
change with its old and new contents. While the journal exists,
`locale:check` exits with an error. The next `pnpm locale` completes the recorded
publication before planning new work. If a listed file matches neither its old
nor its new contents, recovery names the file and writes nothing. The journal
holds all recovery data. Leftover `*.publication.tmp` and
`.locale-publication.json.*.tmp` files hold none and can be deleted. Do not
commit the journal or temporary files.

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

## Hub sections

The hub has one page per section, linked by the catalogue tabs: `/hub/models/`,
`/hub/workflows/` and `/hub/apps/`. The workflows and apps pages show the
showcase until their flag is on. Both are always noindex and left out of the
sitemap, whatever `launchedWorkflowPages` says (it launches only the
`/hub/workflows/<slug>/` pages), so neither has a markdown twin. Old
`/hub/models/?type=workflows` and `?type=apps` links replace themselves with
the section page in the browser, keeping the other query parameters, once that
section's flag is on for the visitor; otherwise they stay on the models
catalogue.

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

## Authentication

Every account call goes to the Cloud origin that `PUBLIC_WORKSHOP_CLOUD_ENV`
selects (see [Which Cloud the Workshop talks to](#which-cloud-the-workshop-talks-to)).
Which identity the header shows is decided once per page load in
`src/config/workshop-account-source.ts`.

**Flag off (default).** Sign-in is the website's own Firebase login. It is
exchanged at `${cloud}/api/auth/token` for a workspace-scoped JWT and cached in
`sessionStorage` (`src/config/workshop-account.ts`). The flag adds one plain
anonymous `GET /api/features` per page load, read for `web_session_probe`. That
read sends no cookie and no custom header, so it needs no preflight. The
session code never loads.

**`unified_web_session` on.** When the probe is `true`, a credentialed
`GET /api/features` with `X-Comfy-Client` reads `unified_web_session`. Only a
literal `true` turns it on. If no answer comes within 800 ms, the page keeps the
Firebase header and never swaps. On the session path:

- Identity comes from `GET ${cloud}/api/auth/session`, read once at boot. The
  browser attaches the `__Host-comfy_session` cookie because the request goes
  to the Cloud host with `credentials: 'include'`. The cookie is host-only, so
  comfy.org itself never receives it. The website runs no heartbeat.
- The header shows the session account and reads `GET /api/billing/balance` on
  the cookie, with `X-Comfy-Client` and no `Authorization`. That balance is
  always the personal workspace's. A 401 hides it. The Buy credits dialog is
  not mounted.
- Firebase does not load to answer the header. The session is restored with
  `POST /api/auth/session` (Firebase ID token as proof) only if this page
  already loaded a Firebase login. With no session, the Firebase header
  mounts. A revoked session also signs the local Firebase login out.
- The website sends no unsafe method on the cookie, so it never needs
  `X-CSRF-Token`. It never calls `DELETE /api/auth/session`, and a Firebase
  sign-in on comfy.org does not create the shared session. Sign-in and
  sign-out on comfy.org are still Firebase's.

**Not wired yet: Run on the session (F3b).** Model pages, workflows and the
cinematic studio start the Firebase lifecycle whatever the flag says. A Run
sends the `/api/auth/token` JWT to the Router as `Authorization: Bearer` with
`credentials: 'omit'`. The session balance's authorizer rejects any mint, so
the website never calls `POST /api/auth/token` on the cookie. Moving Run onto
the session is blocked on the backend. The Router must accept tokens minted
from the session, and ingest must trust comfy.org for credentialed `POST`s.

CLI, MCP, Desktop, API keys and a localhost frontend keep their tokens. The
cookie never reaches localhost or a preview host, so there the session read
finds nothing and the Firebase header mounts. The workflow API's `X-API-Key`
mode (`src/config/workshop-workflow-api.ts`) is unaffected.

See [ADR-AUTH-SESSION-0037](../../docs/adr/AUTH-SESSION-0037-shared-web-session-on-a-host-only-cookie.md)
for the decision and
[`packages/account-core/docs/web-session.md`](../../packages/account-core/docs/web-session.md)
for the shared building blocks.

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
- `pnpm check:router-provider-drift` — compare Router coverage with published sources (requires network access)
- `pnpm test:e2e` — Playwright E2E tests (requires `pnpm build:e2e` first)
- `pnpm ashby:refresh-snapshot` — refresh the committed careers snapshot
- `pnpm cloud-nodes:refresh-snapshot` — refresh the committed cloud nodes snapshot
