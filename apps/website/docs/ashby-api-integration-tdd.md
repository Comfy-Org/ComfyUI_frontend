# TDD: Ashby API Integration for Build-Time Careers Page

Date: 2026-04-24
Status: Proposed
Owner: Website / Brand Refresh
Scope: `apps/website`

## 1. Context

The careers page at `apps/website/src/components/careers/RolesSection.vue` currently ships a **hardcoded** list of roles maintained by hand. This has caused:

- Missing roles (Ops roles were never added)
- Wrong locations (e.g. "London, UK" for a role that isn't based there)
- Broken `applyUrl` links (stale Ashby job IDs)
- Stale copy on mobile (deep-linked inside translations, easy to miss when editing)

Open roles already live in Ashby. The goal is to **fetch them at build time** from the Ashby API, validate the shape, and render the careers page from that data — eliminating the manual sync. The integration must not corrupt the site when the API is down, the key is expired, or the response shape changes.

### Non-goals

- Runtime fetching (the site is statically built — no browser fetch)
- Writing to Ashby (read-only integration)
- Replacing the Ashby-hosted application flow (`applyUrl` continues to point at `jobs.ashbyhq.com/comfy-org/...`)
- Localizing role titles/descriptions (Ashby is the source of truth; i18n only covers static chrome like "Roles", "Apply", category filters)

## 2. Decision Summary

1. Fetch roles at **build time** via Ashby's **public job board API** (`GET /posting-api/job-board/{boardName}`). The endpoint is unauthenticated per Ashby docs; we still send the API key via Basic auth because Ashby ignores credentials on this endpoint if unneeded, and sending them lets us switch to `POST /jobPosting.list` later without changing env wiring. The user explicitly asked for an API-key-scoped secret, so we honor that. (We do **not** claim the public endpoint works for private boards — that's undocumented and not relied on.)
2. Validate the raw response with **Zod** (`safeParse`). Invalid entries are **dropped with a `::warning::` annotation**; a completely invalid envelope, or an envelope where every role fails to parse, is treated the same as an API failure and falls back to the snapshot.
3. On any API failure (network, 4xx/5xx, envelope validation), fall back to a **committed JSON snapshot** at `apps/website/src/data/ashby-roles.snapshot.json`. The snapshot is refreshed **only** by an explicit script (`pnpm ashby:refresh-snapshot`) and by a scheduled workflow that commits the diff — never as a side effect of a normal build. If the snapshot is missing, the build **fails hard** with an actionable `::error::`.
4. The API key is read from `WEBSITE_ASHBY_API_KEY`. Astro only inlines `PUBLIC_*`-prefixed vars into the client bundle, so `WEBSITE_*` is guaranteed **not** inlined. The naming is a convention that scopes the secret to this app (matches existing `VERCEL_WEBSITE_*`); the server-only guarantee comes from Astro's prefix rule, not from the name.
5. Add a **GitHub Actions summary block** on every website build explaining the fetch outcome (fresh/stale/failed), validation drops, and remediation steps. Annotations (`::error::` / `::warning::`) are advisory and do not fail the job on their own — the job fails only when the build itself fails (missing snapshot path).

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Build time (vercel build / pnpm --filter @comfyorg/website build)│
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
   apps/website/src/pages/careers.astro (frontmatter, server ctx)
                                │
                                ▼
   apps/website/src/utils/ashby.ts → fetchRolesForBuild()
        ├─ 1. fetch Ashby public API (Basic auth, API key)
        ├─ 2. safeParse(AshbyJobBoardResponseSchema)
        ├─ 3. filter isListed === true
        ├─ 4. map → domain Role[]
        ├─ 5. on success → return { status: 'fresh', ... } (read-only)
        └─ 6. on failure → read snapshot from disk, return stale roles
                                │
                                ▼
   <RolesSection {departments} locale="en" client:visible />
```

### Why build-time, not runtime

- The site is Astro `output: 'static'`. There is no server to proxy at runtime.
- Build-time fetch means zero client bundle cost, zero runtime latency, and zero CORS. It mirrors the existing `BaseLayout.astro` pattern that calls `fetchGitHubStars` during the build.

### Why the public job board endpoint (not `jobPosting.list`)

| Endpoint                             | Auth                                   | Scope                      | Shape         | Decision                                                            |
| ------------------------------------ | -------------------------------------- | -------------------------- | ------------- | ------------------------------------------------------------------- |
| `GET /posting-api/job-board/{board}` | Optional Basic auth                    | Only listed postings       | Public shape  | **Chosen**                                                          |
| `POST /jobPosting.list`              | Required Basic auth + `jobsRead` scope | All postings (need filter) | Private shape | Rejected — more surface area, needs scope review, data we don't use |

The public endpoint already returns exactly the "listed on the public job board" set — no need to re-implement Ashby's visibility logic.

## 4. External contract (Ashby)

- Base URL: `https://api.ashbyhq.com`
- Endpoint: `GET /posting-api/job-board/{WEBSITE_ASHBY_JOB_BOARD_NAME}?includeCompensation=false`
  - The board name is a separate env var — it's not a secret but it does vary by environment (`comfy-org` in prod, potentially a staging board in future).
- Auth: `Authorization: Basic ${base64(API_KEY + ":")}` (username = API key, password empty, trailing colon required)
- Accept: `application/json; version=1`
- Response envelope (success): `{ apiVersion: "1", jobs: JobPosting[] }`
- Response envelope (auth failure): HTTP `401`/`403` with a human-readable body
- Rate limit: 1,000 req/min per key. We make one request per build. Cache concerns: none.

### Fields we consume (v1)

| Field        | Used as                                             | Required |
| ------------ | --------------------------------------------------- | -------- |
| `title`      | Role title                                          | yes      |
| `department` | Department grouping + filter label                  | yes      |
| `location`   | Displayed location string                           | yes      |
| `isListed`   | Filter (`=== true`)                                 | yes      |
| `applyUrl`   | CTA link target (falls back to `jobUrl` if missing) | no       |
| `jobUrl`     | CTA link target fallback                            | yes      |

Everything else (`team`, `workplaceType`, `employmentType`, `publishedAt`, description, secondary locations, compensation) is intentionally **ignored** for v1 because the existing UI does not render them. Narrowing the schema narrows the failure surface; when the UI grows (e.g. "Remote" badge, sort by newest), the schema and tests expand alongside.

## 5. Zod schemas

Location: `apps/website/src/utils/ashby.schema.ts`

```ts
import { z } from 'zod'

export const AshbyJobPostingSchema = z.object({
  title: z.string().min(1),
  department: z.string().min(1),
  location: z.string().min(1),
  isListed: z.boolean(),
  jobUrl: z.string().url(),
  applyUrl: z.string().url().optional()
})

export const AshbyJobBoardResponseSchema = z.object({
  apiVersion: z.literal('1'),
  jobs: z.array(z.unknown())
})

export type AshbyJobPosting = z.infer<typeof AshbyJobPostingSchema>
```

Notes:

- `apiVersion` is `z.literal('1')` so a major Ashby version bump falls back to snapshot (loud) instead of silently parsing under a changed contract.
- `applyUrl` is `.optional()` and the fetcher normalizes with `apply ?? jobUrl`. Ashby docs show `jobUrl` as always present; `applyUrl` is present on the public endpoint but we don't want the whole role to drop if Ashby ever omits it.
- We do **not** parse `publishedAt`. Ashby emits `2021-04-30T16:21:55.393+00:00` which is not strict RFC 3339 and `z.string().datetime()` rejects it. v1 doesn't sort by date; if we add it later we parse with `new Date(...)` and validate it produced a valid date, not with `z.datetime()`.

Two-stage parsing is deliberate:

1. `AshbyJobBoardResponseSchema` validates the **envelope** (`apiVersion` + `jobs` is an array). A failure here is a whole-response failure → fallback.
2. Each job is parsed individually with `AshbyJobPostingSchema.safeParse`. Individual failures **drop only that role** with a warning. This prevents one bad row (e.g. Ashby ships a new `employmentType` enum value) from breaking the whole page.

### Domain type

Location: `apps/website/src/data/roles.ts`

```ts
export interface Role {
  id: string // stable hash of applyUrl ?? jobUrl
  title: string
  department: string
  location: string
  applyUrl: string // normalized: applyUrl ?? jobUrl
}

export interface Department {
  name: string // uppercase, e.g. 'ENGINEERING'
  key: string // slug, e.g. 'engineering'
  roles: Role[]
}

export interface RolesSnapshot {
  fetchedAt: string // ISO 8601; used for "snapshot age" in CI summary
  departments: Department[]
}
```

`id` is derived from the final link so the frontend has a stable key even though the public API does not return Ashby's internal job UUID. `fetchedAt` is stored **only** in the snapshot file, not in the runtime prop type — the UI is oblivious to whether data is fresh or stale.

## 6. Fetch + failover logic

Location: `apps/website/src/utils/ashby.ts`

```ts
import {
  AshbyJobBoardResponseSchema,
  AshbyJobPostingSchema
} from './ashby.schema'
import type { Department, RolesSnapshot } from '../data/roles'

const DEFAULT_TIMEOUT_MS = 10_000
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]

export type FetchOutcome =
  | { status: 'fresh'; snapshot: RolesSnapshot; droppedCount: number }
  | { status: 'stale'; snapshot: RolesSnapshot; reason: string }
  | { status: 'failed'; reason: string }

// Memoized so two careers pages (en + zh-CN) in the same build share one fetch.
let inflight: Promise<FetchOutcome> | undefined
export function fetchRolesForBuild(): Promise<FetchOutcome> {
  inflight ??= doFetchRolesForBuild()
  return inflight
}

async function doFetchRolesForBuild(): Promise<FetchOutcome> {
  const apiKey = process.env.WEBSITE_ASHBY_API_KEY
  const boardName = process.env.WEBSITE_ASHBY_JOB_BOARD_NAME

  if (!apiKey || !boardName) {
    return fallback(
      'missing WEBSITE_ASHBY_API_KEY or WEBSITE_ASHBY_JOB_BOARD_NAME'
    )
  }

  const result = await tryFetch(apiKey, boardName)
  if (result.kind === 'ok' && result.departments.length > 0) {
    return {
      status: 'fresh',
      snapshot: {
        fetchedAt: new Date().toISOString(),
        departments: result.departments
      },
      droppedCount: result.droppedCount
    }
  }

  // Every role dropped, or envelope invalid, or network/HTTP failure → snapshot.
  const reason =
    result.kind === 'ok' ? 'all roles failed validation' : result.reason
  return fallback(reason)
}

async function fallback(reason: string): Promise<FetchOutcome> {
  const snapshot = await readSnapshot()
  if (snapshot) return { status: 'stale', snapshot, reason }
  return { status: 'failed', reason }
}
```

Key properties:

- **Timeout**: 10s per attempt via `AbortController`.
- **Retry**: 3 attempts, backoff `1s → 2s → 4s`, only on `429` and `5xx`. Auth failures (`401`/`403`) do not retry.
- **Memoization**: `inflight` ensures both `/careers` and `/zh-CN/careers` frontmatters share a single fetch, snapshot read, and CI annotation emission per build.
- **No snapshot write during builds**: the fetcher never writes to disk. That keeps builds idempotent, avoids dirty working trees locally, and prevents the "successful build mutates snapshot that will never be committed from Vercel/CI" trap. The snapshot is updated only via the refresh script (§10).
- **All-roles-drop ⇒ stale**: if the envelope parses but every role fails validation, we treat it the same as a bad envelope and fall back — no empty careers page.
- **Snapshot read**: always available as a fallback path; committed to the repo so fresh clones can build.
- **Pure function at module boundary**: the Astro frontmatter awaits exactly one call. Easy to mock in unit tests.

## 7. Astro page integration

Location: `apps/website/src/pages/careers.astro` (and `apps/website/src/pages/zh-CN/careers.astro`)

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro'
import RolesSection from '@/components/careers/RolesSection.vue'
import { fetchRolesForBuild } from '@/utils/ashby'
import { reportAshbyOutcome } from '@/utils/ashby.ci'

const outcome = await fetchRolesForBuild()
reportAshbyOutcome(outcome)  // idempotent via memoization; second call no-ops

if (outcome.status === 'failed') {
  throw new Error(
    `Ashby fetch failed and no snapshot is available. Reason: ${outcome.reason}. ` +
      `See apps/website/docs/ashby-api-integration-tdd.md#9-failure-modes for remediation.`
  )
}

const departments = outcome.snapshot.departments
---

<BaseLayout>
  <!-- hero, whyJoin, teamPhotos … unchanged -->
  <RolesSection {departments} locale="en" client:visible />
</BaseLayout>
```

The `zh-CN/careers.astro` page passes `locale="zh-CN"` to preserve the existing i18n behavior of `RolesSection`. Both pages share the same fetch via the `inflight` memoization, so Ashby is hit once per build.

`RolesSection.vue` is refactored to accept `departments: Department[]` via `defineProps` alongside its existing `locale` prop. The existing UI (sticky sidebar with `ALL / ENGINEERING / DESIGN / MARKETING` filters) is preserved by deriving the filter list from `departments.map(d => d.name)` instead of hardcoding it.

### CI reporter is single-emit

`ashby.ci.ts` exports `reportAshbyOutcome(outcome)` which uses an internal `hasReported` flag so that calling it from both `careers.astro` files during one build emits exactly one set of annotations and one `$GITHUB_STEP_SUMMARY` block.

## 8. Secrets, env, and CI

### Env vars

| Name                           | Scope           | Where                             | Notes                                                                                                                                           |
| ------------------------------ | --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEBSITE_ASHBY_API_KEY`        | Build-time only | GitHub Actions + Vercel build env | Never referenced from `src/` files that reach the client bundle. Only read inside `fetchRolesForBuild`, which runs in the Astro server context. |
| `WEBSITE_ASHBY_JOB_BOARD_NAME` | Build-time only | GitHub Actions + Vercel build env | Default `comfy-org`. Non-secret; set in plain env.                                                                                              |

### Why the `WEBSITE_*` prefix

- Distinguishes app-scoped envs from cross-cutting secrets like `VERCEL_*`, `CLOUDFLARE_*`.
- Matches the existing `VERCEL_WEBSITE_*` naming used by `ci-vercel-website-preview.yaml`.
- Explicitly **not** `PUBLIC_*` — Astro's convention is that only `PUBLIC_*` vars are inlined into the client bundle, so `WEBSITE_*` is guaranteed server-only.

### .env_example update

Add to the repo root `.env_example`:

```
# Ashby (website careers page build)
WEBSITE_ASHBY_API_KEY=
WEBSITE_ASHBY_JOB_BOARD_NAME=comfy-org
```

### GitHub Actions changes

Modify `.github/workflows/ci-website-build.yaml` and `.github/workflows/ci-vercel-website-preview.yaml`:

```yaml
env:
  WEBSITE_ASHBY_API_KEY: ${{ secrets.WEBSITE_ASHBY_API_KEY }}
  WEBSITE_ASHBY_JOB_BOARD_NAME: ${{ vars.WEBSITE_ASHBY_JOB_BOARD_NAME || 'comfy-org' }}
steps:
  - uses: actions/checkout@v6
  - uses: ./.github/actions/setup-frontend
  - run: pnpm --filter @comfyorg/website build
```

The secret is also configured in the Vercel project environment so that `vercel build` in the preview workflow sees it. Once the secret lands in both GitHub Actions and Vercel, **same-repo PRs** exercise the real Ashby fetch on their Vercel preview URL. Fork PRs do **not** have access to repo secrets (by GitHub design), so they fall back to the committed snapshot — which is exactly the behavior a would-be external contributor should see anyway, and matches how other `VERCEL_WEBSITE_*` secret-gated paths already behave in `ci-vercel-website-preview.yaml`.

## 9. Failure modes and the errors we want to see

`apps/website/src/utils/ashby.ci.ts` prints GitHub Actions annotations and appends to `$GITHUB_STEP_SUMMARY`. Annotations are **advisory** — a `::warning::` or `::error::` on its own does not fail the workflow. The workflow fails only if the build itself fails (§9.6, missing snapshot). The annotations are there to make the cause visible in the PR and the step summary, not to force-fail the job.

The failure modes below are grouped by **root cause**. §9.6 is a degraded variant of 9.2–9.5 rather than a separate cause.

### 9.1 Missing env vars

Happens on a local dev build without the secret, or if the secret is removed from CI.

```
::warning title=Ashby integration::WEBSITE_ASHBY_API_KEY or WEBSITE_ASHBY_JOB_BOARD_NAME is not set. Falling back to committed snapshot.

Action items:
  1. If you're a contributor without key access, this is expected. The snapshot will be used.
  2. If this is CI, check that the `WEBSITE_ASHBY_API_KEY` secret exists in the repo and is referenced in .github/workflows/ci-website-build.yaml.
```

Build **succeeds** with the snapshot. Not an error.

### 9.2 Invalid / expired API key (HTTP 401 / 403)

```
::error title=Ashby authentication failed::HTTP 401 from api.ashbyhq.com. The WEBSITE_ASHBY_API_KEY is missing, invalid, or revoked.

Action items:
  1. Open Ashby → Settings → API Keys and confirm the `website-build` key is active.
  2. If the key was rotated, update the `WEBSITE_ASHBY_API_KEY` secret in:
       - GitHub: https://github.com/Comfy-Org/ComfyUI_frontend/settings/secrets/actions
       - Vercel: https://vercel.com/<org>/comfy-website/settings/environment-variables
  3. Re-run this workflow after updating the secret.
  4. Build will continue with the last-known-good snapshot; the site is still deployable.
```

Build **succeeds** with the snapshot (stale). The `::error::` annotation surfaces in the workflow UI and step summary so the stale state is loud, but the job itself stays green — a silently stale careers page is worse than a visible annotation on a green build.

### 9.3 Ashby API is down (HTTP 5xx or network error after retries)

```
::warning title=Ashby API unavailable::api.ashbyhq.com returned 503 after 3 attempts. Using snapshot fetched 2026-04-20.

Action items:
  1. Check https://status.ashbyhq.com
  2. If Ashby is healthy, re-run this workflow.
  3. If the snapshot is older than a week, run the nightly refresh workflow manually.
```

Build **succeeds** with the snapshot. The "fetched 2026-04-20" date comes from `snapshot.fetchedAt`, not from a normal-build side effect.

### 9.4 Schema validation failure on the envelope

Ashby changed `apiVersion` or removed `jobs`. Wholesale mismatch.

```
::error title=Ashby schema mismatch::Response envelope failed Zod validation. The Ashby API contract has likely changed.

Validation errors:
  - apiVersion: Expected string, received undefined
  - jobs: Expected array, received object

Action items:
  1. Check https://developers.ashbyhq.com/reference for API changelog.
  2. Update apps/website/src/utils/ashby.schema.ts to match the new shape.
  3. Update apps/website/docs/ashby-api-integration-tdd.md section 4/5 if the contract meaningfully changed.
  4. Build will continue with the snapshot, but future updates will fail until the schema is fixed.
```

Build **succeeds** with the snapshot.

### 9.5 Per-role validation drops

A subset of roles fails `AshbyJobPostingSchema`. Most common causes in v1: a role in Ashby is missing a `department`, or its `jobUrl`/`applyUrl` is not a valid URL (e.g. someone typed a relative path into the "external apply URL" field).

```
::warning title=Ashby: dropped 2 invalid role(s)::

Dropped roles:
  - "Senior Platform Engineer": department is required (received empty string)
  - "Contract Designer (EU)": jobUrl is not a valid URL ("jobs/ashby/contract-designer")

Action items:
  1. Fix the posting in Ashby admin (e.g. assign a department, fix the URL).
  2. If the v1 schema is too strict for a legitimate case, relax the field in apps/website/src/utils/ashby.schema.ts and add a test.
  3. These roles will not appear on the careers page until fixed.
```

Build **succeeds** with the valid subset. Normal builds never write the snapshot, so the committed file is unchanged; the next scheduled refresh run will pick up the corrected data.

### 9.6 No snapshot available (compounds 9.2–9.5)

Happens only if one of 9.2–9.5 triggers AND the committed snapshot is missing (e.g. the very first build, or someone deleted the file).

```
::error title=Ashby fetch failed and no snapshot is available::Cannot build careers page without data.

Reason: <original fetch failure reason>

Action items:
  1. Run `pnpm --filter @comfyorg/website ashby:refresh-snapshot` locally with a valid WEBSITE_ASHBY_API_KEY.
  2. Commit apps/website/src/data/ashby-roles.snapshot.json.
  3. Push and re-run CI.
```

Build **fails hard**. This is the only code path where the workflow goes red; a red X here is correct because we genuinely cannot render the page.

### $GITHUB_STEP_SUMMARY block

Every build writes a concise summary so reviewers see the state without digging into logs:

```
## 💼 Careers (Ashby)
| | |
|---|---|
| Status | ✅ Fresh (fetched from Ashby) |
| Roles  | 14 |
| Dropped | 0 |
| Snapshot | apps/website/src/data/ashby-roles.snapshot.json (not written; refresh via `pnpm ashby:refresh-snapshot`) |
```

or on failure:

```
## 💼 Careers (Ashby)
| | |
|---|---|
| Status | ⚠️ Stale (using snapshot — Ashby fetch failed) |
| Roles  | 13 |
| Reason | HTTP 401 Unauthorized |
| Snapshot age | 4 days |
```

## 10. Snapshot strategy

- Location: `apps/website/src/data/ashby-roles.snapshot.json`
- Committed to the repo.
- **Not** updated as a side effect of `astro build`. The only writers are the explicit refresh script (for developers) and the scheduled refresh workflow (§12). This keeps `pnpm build` idempotent and prevents confusion about why a local build mutates the working tree.
- Shape: `RolesSnapshot` (the normalized `{ fetchedAt, departments }` object), not the raw Ashby response. Storing the normalized shape:
  - avoids re-running validation against stale Ashby shapes on every build,
  - keeps the snapshot readable for humans,
  - keeps the frontend code path identical whether data is fresh or stale.

### Refresh script

`apps/website/package.json` adds:

```json
"scripts": {
  "ashby:refresh-snapshot": "node ./scripts/refresh-ashby-snapshot.mjs"
}
```

The script imports `fetchRolesForBuild`, requires `status === 'fresh'`, and writes the snapshot with `fetchedAt = new Date().toISOString()`. Used by developers with a key and by the scheduled workflow. Exits non-zero on any non-fresh outcome so accidental commits of stale/empty snapshots are impossible.

## 11. Rendering impact

`apps/website/src/components/careers/RolesSection.vue` changes (only what's required):

- Remove the hardcoded `departments` constant.
- Accept `departments: Department[]` via `defineProps`, **alongside the existing `locale` prop** — do not replace it.
- Derive the category filter list from `departments.map(d => d.name)` so new departments appear automatically.
- Preserve existing markup, styles, i18n keys, and sticky-sidebar behavior.
- Handle the zero-roles case explicitly: render "No open roles right now. Check back soon." using the existing `careers.roles.empty` i18n key (add it to `en` and `zh-CN` translations). This state was unreachable before and must exist in v1 because a stale snapshot could theoretically contain it.

## 12. Scheduled snapshot refresh (optional, follow-up)

A nightly workflow `.github/workflows/ashby-refresh-snapshot.yaml` runs on cron, calls the refresh script, and opens a PR if the snapshot changed. This keeps the snapshot fresh even during weeks where no website code changes ship. Explicitly **out of scope** for the initial PR — filed as a follow-up so the initial PR stays reviewable.

## 13. Testing

### Vitest setup

`apps/website` does not currently have a Vitest config. The implementation PR adds:

- `apps/website/vitest.config.ts` with `environment: 'node'` (we only unit-test Node-side utils).
- `apps/website/package.json` scripts `"test:unit": "vitest run"` and `"test:coverage": "vitest run --coverage"`.
- An Nx target in `apps/website/project.json` (or package.json) so `pnpm --filter @comfyorg/website test:unit` works.
- **CI wiring is not automatic.** `.github/workflows/ci-tests-unit.yaml` currently runs only the root `pnpm test:coverage` script. The implementation PR must either (a) extend the root `test:coverage` script to include `apps/website` (preferred — reuses the existing Codecov upload), or (b) add a new job in `ci-tests-unit.yaml` that runs `pnpm --filter @comfyorg/website test:coverage`. Option (a) is simpler; option (b) keeps website unit tests in their own job for easier triage.

### Unit (Vitest) — `apps/website/src/utils/ashby.test.ts`

1. `fetchRolesForBuild` returns `{ status: 'fresh', ... }` when the API returns a valid payload.
2. A role missing `applyUrl` falls back to `jobUrl` and is kept (not dropped).
3. A role with a non-URL `jobUrl` is dropped with a warning; other roles survive.
4. When **every** role fails validation, the outcome is `stale` (not `fresh` with 0 roles), and the snapshot is used.
5. Missing `WEBSITE_ASHBY_API_KEY` with a present snapshot → `status: 'stale'` with reason `'missing env'`.
6. Missing env AND missing snapshot → `status: 'failed'`.
7. On HTTP 401, returns `stale` and does not retry.
8. On HTTP 503, retries 3 times with backoff and falls back to snapshot.
9. On envelope schema mismatch (`apiVersion: '2'`), returns stale.
10. `fetchRolesForBuild` called twice in one process hits `fetch` exactly once (memoization).
11. The fetcher never writes to disk — the snapshot file is byte-identical before/after.
12. `reportAshbyOutcome` called twice emits annotations exactly once.

Mock `fetch` via `vi.stubGlobal`. Snapshot I/O is injected via a module-level URL so tests can point it at a fixture. No mocks of Ashby's server — we test our boundary.

### E2E (Playwright) — `apps/website/e2e/careers.spec.ts`

1. `@smoke`: careers page renders at least one role card derived from the snapshot fixture.
2. `@smoke`: `/zh-CN/careers` renders roles too and keeps the `locale="zh-CN"` static chrome.
3. Category filter ("ENGINEERING") narrows the visible role list.
4. Each role card's CTA has `href` starting with `https://jobs.ashbyhq.com/`.
5. When the snapshot has zero roles (a dedicated empty-snapshot fixture run), the empty-state copy is shown.

E2E tests run against the built site, so they exercise whatever snapshot ships in the repo. No live API calls.

### Type-only

`pnpm --filter @comfyorg/website typecheck` must pass — the domain `Role` type flows from schema → fetcher → Astro frontmatter → Vue prop without `any` or `unknown` leaking.

## 14. Security

- The API key never appears in the client bundle. Enforced by:
  - Reading it only inside `fetchRolesForBuild`, which runs in the Astro server/build context.
  - Astro only inlines `PUBLIC_*`-prefixed vars into the client bundle; `WEBSITE_ASHBY_API_KEY` has no such prefix, so it is not inlined.
- Because GitHub Actions masks the secret value in logs with `***`, grepping for the variable **name** in `dist/` is not a useful leak check. Instead, the implementation PR adds a CI step that grabs the first 8 characters of the secret value at job start and greps for that literal in `apps/website/dist/`. If it appears, the job fails. This catches accidental inlining that the prefix rule is supposed to prevent.
- Snapshot content is low-sensitivity (it's the same data the public careers page displays), so committing it is safe.
- No user input reaches the Ashby call — zero injection surface.

## 15. Rollout

1. Land this TDD (this PR).
2. User adds `WEBSITE_ASHBY_API_KEY` as a GitHub Actions secret and as a Vercel environment variable.
3. Land the implementation PR (tests + code + initial snapshot + workflow env wiring).
4. Verify on the PR preview URL that the page renders Ashby-sourced roles.
5. Merge. Production picks up the same env and uses the real API on the next main build.
6. (Follow-up) Land the scheduled nightly snapshot refresh workflow.

## 16. Consequences

### Positive

- Roles, locations, and apply links are always current — no more "London, UK" surprises.
- The site stays deployable during Ashby outages.
- New departments (e.g. Operations) appear without a code change.
- Schema changes fail loud (annotations + step summary) but never block the deploy.

### Negative

- Extra build-time I/O (one HTTP call). Bounded by a 10s timeout; adds <1s on the happy path.
- A snapshot file in the repo that can drift from Ashby on long branches. Mitigated by the nightly refresh workflow.
- Ashby API contract changes must be handled in code (Zod schema edits). Expected to be rare (v1 API is stable) and the errors are explicit about where to edit.

## 17. References

- Ashby public job board API: https://developers.ashbyhq.com/docs/public-job-posting-api
- Ashby auth + error shape: https://developers.ashbyhq.com/docs/authentication, https://developers.ashbyhq.com/docs/responses
- GitHub Actions workflow commands (`::error::`, `::warning::`, `$GITHUB_STEP_SUMMARY`): https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
- Existing build-time fetch pattern: `apps/website/src/utils/github.ts` + `apps/website/src/layouts/BaseLayout.astro`
- Existing consolidated-comment pattern in CI: `.github/actions/upsert-comment-section`
