# Staging smoke gate

The release gate for a deployed Cloud frontend. One signed-out Playwright spec,
run against the real deployment, answering the one question `Verify staging
runtime` cannot: **does the deployed frontend actually work?**

- Spec: `browser_tests/tests/liveCloud/stagingSmoke.spec.ts`
- Tag: `@staging-smoke`
- Entry point: `STAGING_SMOKE_URL=<staging-origin> pnpm smoke:staging` — **the only supported invocation**

## Run it

The caller supplies the deployment origin; this repository does not carry it.

```sh
STAGING_SMOKE_URL=<staging-origin> pnpm smoke:staging
```

There is **no default origin, by design**. Unset, the script fails immediately
naming the variable rather than silently smoking some other environment:

```
STAGING_SMOKE_URL: set this to the origin of the deployment to smoke
```

`STAGING_SMOKE_URL` must be a test, staging, or PR preview origin; the fixture's
own origin schema is what decides, see [Guard rails it inherits](#guard-rails-it-inherits).

| Variable               | Default                     | Purpose                                                                         |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `STAGING_SMOKE_URL`    | none — **required**         | Deployment under test. Sets both `PLAYWRIGHT_TEST_URL` and `OPEN_ON_CLOUD_URL`. |
| `STAGING_SMOKE_REPORT` | `staging-smoke-report.json` | Where the JSON reporter writes. Count `stats.expected + stats.flaky` from it.   |

The script sets `PLAYWRIGHT_CLOUD_LIVE=1` (which selects the `cloud-live`
project and skips the local-backend global setup) and runs
`--grep @staging-smoke --retries=2 --workers=1 --reporter=json`.

It needs **no `CLOUD_ACCOUNT_*` credentials and no local ComfyUI backend**. That
is the point: it ships ahead of the test-account work.

The JSON report goes to a file rather than stdout because `pnpm` writes its own
lines to stdout, which would corrupt a piped parse of the report.

Count tests run as `stats.expected + stats.flaky`. With `--retries=2`, a test
that fails and then passes on retry is reported under `stats.flaky`, not
`stats.expected`, and the run still exits 0. Reading `stats.expected` alone
would score a passing gate as zero tests run.

### Do not use the bare `cloud-live` project as the gate

```sh
# WRONG - runs 8 other tests that need a local frontend and backend
pnpm exec playwright test --project=cloud-live
```

Only 1 of the 9 specs in `cloud-live` targets a deployed frontend. The other 8
drive a **local** frontend against a remote Cloud origin and will fail without
`localhost:5173` and `localhost:8188` (see
[open-on-cloud-e2e.md](./open-on-cloud-e2e.md)). `--grep @staging-smoke` is what
makes this a deployment gate. `browser_tests/playwrightSelection.test.ts` asserts
that the tag still selects exactly one spec.

## What it asserts

1. **Every same-origin JS/CSS chunk the boot requested was served.** This is the
   poisoned-asset-cache failure (IR-105): `/` can advertise the new commit while
   `/assets/*` serve stale or 404 chunks, which a `curl` on `/` structurally
   cannot see. Checked right after `load` so a broken deploy reports the 404'd
   chunk rather than a downstream "element not found", and again at the end,
   after every chunk still in flight has settled, to catch lazily fetched ones.
2. **The signed-out entry point renders** — the login heading and the Google
   button. Asserted softly, so a deployment that boots but renders nothing still
   reports the console errors that explain why.
3. **No console errors or uncaught exceptions during boot.**

Because the spec carries no comments (see `AGENTS.md`), this page is where its
reasoning lives. Reading the spec alongside these notes:

- It navigates to `cloudOrigin`, the value the fixture's origin schema has
  already accepted, not to `baseURL`. The schema never sees `PLAYWRIGHT_TEST_URL`,
  so navigating relative to it would let a stray value (a `.env`, a hand-written
  invocation) smoke an origin nothing checked.
- `collectAppChunkFailures` (`browser_tests/fixtures/utils/deploymentSmoke.ts`)
  watches only **same-origin** `script`/`stylesheet` requests. A third-party tag
  or font failing is noise; a chunk the deployment itself serves failing is the
  bug this gate exists for. A 404 chunk fires both `response` and
  `requestfailed`, so it records the first line per URL. It also counts requests
  still in flight, which a later step polls to zero before asserting, so a
  chunk that fails after the login shell is visible still fails the run. The
  console check runs after that settle, so a late chunk that loads but throws is
  caught too; the late-chunk assertion is soft so that case still reports the
  console errors.
- The render assertions are `expect.soft` so that a deployment which boots but
  renders nothing still reports the console errors that explain it, instead of
  stopping at the missing heading.
- The render timeout is 10s, below the project's 30s. A healthy login shell
  renders in about 2s, so a broken deploy fails quickly.

## What it deliberately does not assert

**The served commit.** The release workflow's runtime-verification step owns that
check, which is why the spec's `describe` title says so out loud. Re-asserting it
here would duplicate the plumbing and make "which check failed?" ambiguous. If
you are about to add a version or SHA assertion to this spec: don't — fix or
extend that step instead.

**Anything behind sign-in.** Signed out, a visitor is redirected to
`/cloud/login`: `window.app` is never defined and there is no `#graph-canvas`.
The login shell _is_ the render for this audience. Canvas, default graph, core
chrome and node search belong in the authenticated gate that follows the
test-account work.

**Feature behaviour, visual snapshots, anything mutating.** Those live in the
pre-merge suite. The gate exists to fail when someone opening the deployment
would immediately see something broken, and to stay quiet otherwise.

## Rules the gate depends on

These are enforced by `browser_tests/playwrightSelection.test.ts`, not by review:

- **Never tag it `@cloud` or `@auth`.** Either tag makes the shared
  `comfyPageFixture` stub auth, billing, workspace and Firebase
  (`browser_tests/fixtures/ComfyPage.ts`), and a gate that mocks the backend
  proves nothing about the deployment. The test rejects any tag matching
  `/cloud|auth/`, because the `cloud` project's `grep: /@cloud/` matches
  `@cloud-live` by substring too.
- **It never joins the pre-merge collection.** `testIgnore: ['**/liveCloud/**']`
  in `playwright.config.ts` guarantees this; the test asserts neither the `cloud`
  nor the `chromium` project collects a `liveCloud/` spec, so a future
  `testIgnore` edit cannot regress it silently.

## Guard rails it inherits

The spec reuses `liveOpenOnCloudLoginFixture` from
`browser_tests/fixtures/liveOpenOnCloudFixture.ts` unchanged:

- `cloudOriginSchema` admits only https test, staging and PR preview origins, so
  **a production origin is a schema error**. Pointing the gate at
  `<production-origin>` fails in under two seconds without launching a browser.
  That schema is the single place those origins are described; this page
  deliberately does not repeat them.
- The `liveNetworkOrigins` allowlist plus the shared network-isolation guard
  abort, and fail the run on, any request to an origin outside the list. That is
  an **egress restriction, not a read-only guarantee**: the guard checks request
  methods only when `liveCloudBillingConfig` is set, which this spec does not do,
  so the page's own telemetry POSTs to allowlisted origins go through. The spec
  itself performs no writes.

The spec reaches those guard rails without using the fixture's `comfyPage`: it
requests `page` and `cloudOrigin` instead. Playwright resolves fixtures lazily,
so `comfyPage` — which would `waitForAppReady()` and assert the canvas, neither
of which exists signed out — never runs. `networkPolicy` is declared
`{ auto: true }` and depends on `liveNetworkOrigins`, so the origin schema and
the allowlist are applied before the test body starts, with no fixture change.

Google Tag Manager is stubbed with an empty script in the spec's `beforeEach` —
the one origin the signed-out page needs that the allowlist does not carry.
Stubbing the loader means the tags it would pull in never fire. Stubbed rather
than allowlisted so the gate's verdict does not depend on Google's uptime and so
a release does not fire real conversion pixels. It is third-party
instrumentation; nothing the deployment itself serves is stubbed.

## Known allowance

`isBootConsoleErrorInEveryCloudEnvironment` admits exactly one console line: the
browser's `Failed to load resource` 404 for `/api/i18n`, which returns 404 on
every Cloud environment, production included, so the frontend logs it on every
boot everywhere. An error present in both a good and a bad deploy cannot
distinguish them. The match is anchored to that whole line, so an uncaught
exception, a `console.error`, or a non-404 status that merely mentions the
endpoint still fails the run; `deploymentSmoke.test.ts` pins this. **The
allowance must shrink, never grow** — a new entry means the gate stopped
catching something.
