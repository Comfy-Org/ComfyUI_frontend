# Real Cloud billing E2E setup

## 1.61 billing rollout

`billing_new_ux_enabled` controls the billing behavior introduced after 1.60.
It defaults to false when absent or malformed. With the flag off, the app keeps
the old Add credits dialog, tier-based billing notices and Enterprise 14-day
notice window, direct Plans hand-off with an in-app pricing-table fallback,
static auto top-up notice for members, and Activity without the member column.
Turning it on selects the new dialog, served notice audience/start, refusal
and blocked-tab explanations, same-tab Plans entry, member auto top-up status,
and Activity member column. `pricing_table_fallback`
continues to select the old Plans fallback while the new UX is enabled.

The locked-credit Subscribe to Run entry already shipped in Cloud 1.60 and stays
independent of this flag. SDK payment-rail flags remain independent.
With the flag off, the Billing settings tab is the 1.60 tab, restored as
`BillingTabLegacy.vue` with its rules under `src/platform/billing/legacy160/`.
Its root carries `data-billing-release="1.60"`. With the flag on, the tab renders
through the SDK rule packages. Delete both together with the flag.

Mocked browser tests opt in through the `billingNewUx` fixture option. Set it to
false to exercise the default 1.60 path; do not enable the flag in that case's
`/api/features` response or server flags. Real-account tests use the account's
served flag value.

The rollout browser cases use `mockCloudComfyPageFixture`, which extends
`comfyPageFixture` with the `ComfyPage` page object and network isolation. Their
Cloud boot helper supplies fresh mocked settings and APIs before navigation
instead of the default fixture's OSS backend bootstrap.

## Live test setup

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

Run `pnpm dev:cloud:staging` for staging or `pnpm dev:cloud` for Test Cloud.
Set `PLAYWRIGHT_TEST_URL` to the Vite URL and
`PLAYWRIGHT_SETUP_API_URL` to the matching Cloud origin. The fixture forwards
local browser API requests to that sandbox and derives its customer API origin.
For a deployed frontend, set both URLs to the deployment origin so the browser
sends requests directly. Production targets are rejected.

Live tests use the deployed app's feature settings. Permanent accounts must
have completed onboarding. Disposable setup completes the real survey and waits
for the canvas. The fixture dismisses the onboarding coachmarks as they appear.

The billing smoke validates the browser's real billing-status response, waits
for app readiness, and attaches a screenshot of the visible graph canvas. The
network boundary permits the auth and customer provisioning requests, select
startup and onboarding writes, and known third-party endpoints. Bulk settings
writes may contain only `onboarding_survey`. The default fixture blocks checkout,
payment, and reset mutations in the browser and Playwright API clients. A
disallowed mutation fails the test even if the app catches it.

POSTs a deployed build sends on its own are blocked as well but do not fail the
test: Datadog RUM, Sentry, Mixpanel, PostHog (so a run has no live PostHog
flags), and, on the app's own origin, the Cloudflare bot check and the RES4LYF
custom-node extension. `blocked-egress.json` lists them with a `Background`
prefix.

## Shared setup

Use dedicated accounts for the selected environment.

Shared support includes authenticated API reads/writes, disposable sandbox
accounts, hosted checkout interaction, and paid-subscription provisioning used
by checkout and lifecycle tests. Shared helpers do not add scenario specs here.
Unpaid recovery, top-up assertions, decline recovery, lifecycle transitions, and
3DS outcomes stay in their own PRs.

Scenario fixtures opt in to the permissions they need. Select `cloud-live-paid`
for saved-card tests and `cloud-live-disposable` for new-account tests.

Automatic tracing stays disabled because authenticated traffic contains reusable
credentials. Use screenshots for evidence.
Completed-payment assertions verify saved cards through the real hosted billing
portal, because sandbox environments may disable the embedded-checkout saved-card API.
