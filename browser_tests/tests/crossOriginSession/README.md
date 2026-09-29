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

| Variable                        | Example                           | Needed by                              |
| ------------------------------- | --------------------------------- | -------------------------------------- |
| `SESSION_E2E_CLOUD_URL`         | `https://testcloud.comfy.org`     | Cloud tab                              |
| `SESSION_E2E_CLOUD_UPSTREAM`    | `http://localhost:4173`           | Serve Cloud's pages from a local build |
| `SESSION_E2E_WEBSITE_URL`       | `https://testwebsite.comfy.org`   | Website tab; must be on test's list    |
| `SESSION_E2E_WEBSITE_UPSTREAM`  | `http://localhost:4321`           | Website tab                            |
| `SESSION_E2E_BILLING_URL`       | `https://testbilling.comfy.org`   | billing-web tab                        |
| `SESSION_E2E_BILLING_UPSTREAM`  | `http://localhost:5174`           | Optional: serve billing-web locally    |
| `SESSION_E2E_PLATFORM_URL`      | test platform origin              | Platform tab                           |
| `SESSION_E2E_EMAIL`             | an email/password test-env user   | Signed-in tests                        |
| `SESSION_E2E_PASSWORD`          |                                   | Signed-in tests                        |
| `SESSION_E2E_TEAM_WORKSPACE_ID` | a team workspace the account owns | Workspace tests                        |
| `SESSION_E2E_EXTRA_ORIGINS`     | `https://testapi.comfy.org`       | Other origins a run must reach         |

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
`session-flag-on` takes `@flag-on` tests. Only Cloud reads `ff:`: the Cloud tab
gets `?ff=unified_web_session:<value>`, which a deployed build honours only for
an email-verified `@comfy.org` account (`SESSION_E2E_EMAIL` must be one), and
`localStorage` `ff:unified_web_session`, which dev builds read. The website and
billing-web decide the flag from the `web_session_probe` in `/api/features`, not
from `ff:`. The server rule (BE-17135) still requires `web_session_enabled` for
the account in PostHog; `revoke-all` returns 404 when it is off, and the suite
fails with that message.

The account is dedicated to this suite. In the `session-flag-on` project every
test signs the account out of all devices before it starts and again when it
ends, so nothing else may use the account while the suite runs. Runs are serial
(one worker). `POST /api/auth/session` has an hourly create limit; a 429 there
fails sign-in with a message saying so, so budget the session creates.

## Serve Cloud locally

The testcloud Cloud frontend is an old build without the web session client, and
the flag key does not exist there. Set `SESSION_E2E_CLOUD_UPSTREAM` to a local
production build of this checkout. The fixture serves Cloud's pages and assets
from it under the testcloud name, and sends `/api`, `/ws`, `/internal` and the
other backend paths to real testcloud. Because it is a production build, the
flag comes from `?ff=` for a verified `@comfy.org` user. Remove the upstream
once testcloud serves 1.56 or later.

`SESSION_E2E_CLOUD_UPSTREAM` must be a local address, like the other upstreams.

## Run locally

```sh
PUBLIC_WORKSHOP_CLOUD_ENV=test PUBLIC_WORKSHOP_ENABLED=1 pnpm --filter @comfyorg/website dev --port 4321
pnpm build:cloud && pnpm preview --port 4173 --strictPort

pnpm exec playwright test --config playwright.session.config.ts --list
pnpm exec playwright test --config playwright.session.config.ts --project=session-flag-off
pnpm exec playwright test --config playwright.session.config.ts --project=session-flag-on
pnpm exec playwright show-report playwright-report/session
```

`PUBLIC_WORKSHOP_ENABLED=1` makes the website dev server render the sign-in
header that `E2E-08` looks for. Add `SESSION_E2E_CLOUD_UPSTREAM=http://localhost:4173`
to the environment.

`HARNESS-01` loads the website on its `comfy.org` name from the local upstream,
checks that a request from it to Cloud carries that name as `Origin`, signs in
on Cloud with the flag off and checks that the Firebase recorder saw the
sign-in.

## Test ids

Runnable today: `HARNESS-01`, `E2E-03`, `E2E-08`, `E2E-09` (Cloud steps),
`FS-07`, `FS-12` and `SO5`. Every other row is a definition-level `test.fixme`
with no body, so it skips before any fixture runs. Its `blocked-by` annotation
names what it really waits for: the probe on testcloud (BE-17276), a member
account, a backend clarification, or a row unit tests already cover. Write the
steps against the API contract in TDD section 9 and turn it into a `test` once
the blocker is gone. Ids are stable; keep them.

- `E2E-01`..`E2E-09`: the section 17 end-to-end rows, including flag off.
- `FS-xx`: the failure sequences, numbered in TDD order. FS-03, FS-04, FS-05,
  FS-16 and FS-17 are backend-only and are not listed here.
- `SS1`..`SS6`, `SO1`..`SO6`: the Milestone 2 billing-web handoff cases on the
  shared session.

Helpers: `tab.firebaseCalls`, `tab.sessionCalls` and `tab.tokenMints` record
requests per tab (`expectNone(label)` once the tab has settled), and
`tab.reset()` clears them and the sockets so the next step is read on its own.
`tab.sockets.waitForSocket()`, `waitForClose()` and `tab.cloudSocket()` observe
sockets. `tab.nextSessionRequest()` returns the workspace header and the
Authorization of the first workspace-scoped session request since the last
reset, and `tab.nextTokenRequest()` the first Bearer request. `tab.goto(path, {
ff })` overrides the flag for one navigation. `signInOnCloud()`,
`submitEmailSignIn()` sign in through the Cloud login
page, and `expectOnWebSession()` and
`expectOffWebSession()` assert which credential Cloud uses.

`sessionAdmin` is the same account acting from another device, with its own
cookie jar: `revokeAll()`, `workspaces()` and `readSessionWithoutOrigin()`. It
goes through the same egress rules as the browser.
