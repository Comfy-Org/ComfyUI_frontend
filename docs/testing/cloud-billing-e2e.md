# Real Cloud billing E2E setup

Run the opt-in `cloud-live` project through the existing browser-test runner:

```sh
pnpm exec cross-env DISTRIBUTION=cloud PLAYWRIGHT_CLOUD_LIVE=1 pnpm exec playwright test --project=cloud-live --workers=1 --headed
pnpm exec playwright show-report
```

Set these variables using the existing `.env` convention before running the
command above, or inject them and run the test in one command:

```sh
op run --env-file <file-with-secret-references> -- pnpm exec cross-env DISTRIBUTION=cloud PLAYWRIGHT_CLOUD_LIVE=1 pnpm exec playwright test --project=cloud-live --workers=1 --headed
```

| Variable                   | Value                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| `PLAYWRIGHT_TEST_URL`      | URL serving the PR frontend, usually `http://localhost:5173`       |
| `PLAYWRIGHT_SETUP_API_URL` | Cloud backend origin; defaults to `https://stagingcloud.comfy.org` |
| `CLOUD_ACCOUNT_EMAIL`      | Dedicated account email for the selected environment               |
| `CLOUD_ACCOUNT_PASSWORD`   | Account password for the selected environment                      |

Start the PR checkout's frontend with the matching existing dev script. Set the
backend variable in the terminal running Playwright:

| Environment       | Frontend command                           | `PLAYWRIGHT_SETUP_API_URL`       |
| ----------------- | ------------------------------------------ | -------------------------------- |
| Staging (default) | `pnpm dev:cloud:staging`                   | `https://stagingcloud.comfy.org` |
| Test Cloud        | `pnpm dev:cloud:test`                      | `https://testcloud.comfy.org`    |
| Production        | `USE_PROD_CONFIG=true pnpm dev:cloud:prod` | `https://cloud.comfy.org`        |

For example, after starting `pnpm dev:cloud:staging` and injecting credentials:

```sh
DISTRIBUTION=cloud PLAYWRIGHT_CLOUD_LIVE=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 pnpm exec playwright test --project=cloud-live --workers=1
```

Restart the frontend when switching environments and use that environment's
account credentials. The fixture forwards frontend API requests to the selected
backend and derives its matching customer API and Stripe checkout mode. A deployed
frontend must match the selected backend origin; local URLs exercise the PR code.

Live tests do not install shared response mocks or override feature flags.
Permanent accounts must have completed onboarding when the survey flag is
enabled. Disposable setup completes the real survey and waits for the canvas. Known tutorial dialogs are dismissed through their Skip button whenever
they appear during an interaction, including after navigation. Billing dialogs
are left to the scenario. Assets,
location detection, Google auth scripts, analytics, and feature flags use their real
services. Accounts must have the hosted checkout flow enabled in the selected
environment.

The smoke test signs in, validates the browser's real billing-status response,
waits for app readiness, and checks that the graph canvas is visible.
It attaches a post-login screenshot. The shared network boundary rejects Cloud and Stripe mutations except the specific
POST endpoints used for Firebase sign-in/token refresh, customer provisioning,
Cloud auth tokens/session cookies, the startup write to
`/api/settings/Comfy.InstalledVersion`, and onboarding survey/tutorial state.
Bulk settings writes may contain only `onboarding_survey`. Observed analytics,
customer-messaging, and feature-flag POST endpoints have exact URL allowances;
unknown off-origin mutations are blocked and fail teardown.
A rejected mutation fails the test even
if the app catches the request error. The smoke fixture blocks checkout, payment, and reset mutations in both browser
routing and Playwright API clients.

## Shared setup

Use dedicated accounts for the selected environment. PRs #17870, #17538, #17543,
#17548, and #17545 each depend directly on this setup PR, #17481.

Shared support includes authenticated API reads/writes, disposable sandbox
accounts, hosted checkout interaction, and paid-subscription provisioning used
by checkout and lifecycle tests. Shared helpers do not add scenario specs here.
Unpaid recovery, top-up assertions, decline recovery, lifecycle transitions, and
3DS outcomes stay in their own PRs.

The smoke fixture denies billing mutations. Scenario fixtures explicitly opt in
to the permissions they need. Payment and disposable-account tests reject
production; Staging remains the default backend. Select `cloud-live-paid` for
saved-card tests and `cloud-live-disposable` for new-account tests. These projects
collect tests only when their respective scenario PRs are present.

Automatic tracing stays disabled because authenticated traffic contains reusable
credentials. Use screenshots for evidence.
Completed-payment assertions verify saved cards through the real hosted billing
portal, because sandbox environments may disable the embedded-checkout saved-card API.
