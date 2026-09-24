# Cross-origin session E2E (testcloud)

Opt-in suite for the shared web session (`unified_web_session`, TDD section 17,
FE-2906). It never runs in the default `playwright.config.ts` run or in CI; it
runs only through `playwright.session.config.ts` against the test environment
(testcloud). The web session backend is not on staging yet; point the variables
at staging instead once it is. Any non-production `comfy.org` origin works.

- Cloud (`testcloud.comfy.org`) and platform are the real test deployments, so
  the cross-origin calls and the cookie are real.
- The website has no test host. The harness serves a locally running website
  under a `comfy.org` name, so the browser sends that name as `Origin` and the
  test environment's trusted-origin list is exercised. This proves Origin and trusted-origin
  behaviour only, not TLS, DNS or the website's hosting.
- billing-web can be the test deployment (`testbilling.comfy.org`), or local the same way as the
  website.

All tabs share one browser context, so they share the cookie jar.

## How the comfy.org name works

The fixture routes every request for `SESSION_E2E_WEBSITE_URL` (and
`SESSION_E2E_BILLING_URL` when `SESSION_E2E_BILLING_UPSTREAM` is set) to the
local upstream and fulfils it in the browser. The page URL, `Origin`, secure
context and same-site checks all use the `comfy.org` name, with no local TLS
certificate and no `/etc/hosts` change. Responses served this way carry
`x-session-e2e-upstream`.

`--host-resolver-rules` would also rename the host, but an `https://` name then
needs a local TLS server on 443 and a trusted certificate. The `__Host-` cookie
needs a secure origin, so plain http under a `comfy.org` name does not work.

## Environment

Put these in `.env` (`playwright.session.config.ts` loads it) or inject them
with `op run`. Never commit credentials. Production hosts are rejected as
variables, and a request to one is blocked and fails the test, even when listed
in `SESSION_E2E_EXTRA_ORIGINS`.

| Variable                        | Example                           | Needed by                           |
| ------------------------------- | --------------------------------- | ----------------------------------- |
| `SESSION_E2E_CLOUD_URL`         | `https://testcloud.comfy.org`     | Cloud tab                           |
| `SESSION_E2E_WEBSITE_URL`       | `https://www.comfy.org`           | Website tab; must be on test's list |
| `SESSION_E2E_WEBSITE_UPSTREAM`  | `http://localhost:4321`           | Website tab                         |
| `SESSION_E2E_BILLING_URL`       | `https://testbilling.comfy.org`   | billing-web tab                     |
| `SESSION_E2E_BILLING_UPSTREAM`  | `http://localhost:5174`           | Optional: serve billing-web locally |
| `SESSION_E2E_PLATFORM_URL`      | test platform origin              | Platform tab                        |
| `SESSION_E2E_EMAIL`             | a dedicated test-env account      | Signed-in tests                     |
| `SESSION_E2E_PASSWORD`          |                                   | Signed-in tests                     |
| `SESSION_E2E_TEAM_WORKSPACE_ID` | a team workspace the account owns | Workspace tests                     |
| `SESSION_E2E_EXTRA_ORIGINS`     | `https://testapi.comfy.org`       | Other origins a run must reach      |

A test whose variables are missing is skipped with the names it needs.

Egress fails closed. A `comfy.org` origin is reachable only when it is one of
the `SESSION_E2E_*_URL` values or in `SESSION_E2E_EXTRA_ORIGINS`; any other
`comfy.org` request is aborted as `Unlisted comfy.org`, and unlisted
third-party requests are aborted too. Both are attached as
`blocked-egress.json`; only `Production` entries fail the test. The website
built with `PUBLIC_WORKSHOP_CLOUD_ENV=test` calls the Router at
`https://testapi.comfy.org` besides `testcloud.comfy.org`, so add that to
`SESSION_E2E_EXTRA_ORIGINS` when a run needs the Router. Check
`blocked-egress.json` for anything else a run was refused.

## Flag on and flag off

Two projects run the same files. `session-flag-off` takes `@flag-off` tests,
`session-flag-on` takes `@flag-on` tests. Each tab gets `ff:unified_web_session`
in `localStorage`, which dev builds read, and the Cloud tab also gets
`?ff=unified_web_session:<value>`, which deployed builds honour only for an
email-verified `@comfy.org` account. The server rule (BE-17135) still requires
`web_session_enabled` for that account in PostHog.

## Run locally

```sh
PUBLIC_WORKSHOP_CLOUD_ENV=test pnpm --filter @comfyorg/website dev --port 4321

pnpm exec playwright test --config playwright.session.config.ts --list
pnpm exec playwright test --config playwright.session.config.ts --project=session-flag-off
pnpm exec playwright test --config playwright.session.config.ts --project=session-flag-on
pnpm exec playwright show-report playwright-report/session
```

`HARNESS-01` is the one runnable test today. It loads the website on its
`comfy.org` name from the local upstream, checks that a request from it to Cloud
carries that name as `Origin`, signs in on Cloud with the flag off and checks
that the Firebase recorder saw the sign-in.

## Test ids

Every other row is a definition-level `test.fixme` with no body, so it skips
before any fixture runs. Its `blocked-by` annotation names the tickets and
backend slices it waits for. Write the steps against the API contract in TDD
section 9 and turn it into a `test` once the blockers are live on testcloud.
Ids are stable; keep them.

- `E2E-01`..`E2E-09`: the section 17 end-to-end rows, including flag off.
- `FS-xx`: the failure sequences, numbered in TDD order. FS-03, FS-04, FS-05,
  FS-16 and FS-17 are backend-only and are not listed here.
- `SS1`..`SS6`, `SO1`..`SO6`: the Milestone 2 billing-web handoff cases on the
  shared session.

Helpers: `tab.firebaseCalls` and `tab.sessionCalls` record requests per tab
(`expectNone(label)` once the tab has settled), `tab.sockets.waitForSocket()` and
`waitForClose()` observe a socket closing, `tab.nextWorkspaceId()` reads the
`X-Comfy-Workspace-ID` of the next API request, and `signInOnCloud()` signs in
through the Cloud login page.
