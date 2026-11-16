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
SDK rule extraction does not change which behavior the flag selects.

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

| Variable                   | Value                                                |
| -------------------------- | ---------------------------------------------------- |
| `PLAYWRIGHT_TEST_URL`      | Local frontend URL or deployed sandbox origin        |
| `PLAYWRIGHT_SETUP_API_URL` | Matching test, staging, or PR sandbox backend origin |
| `CLOUD_ACCOUNT_EMAIL`      | Sandbox account email                                |
| `CLOUD_ACCOUNT_PASSWORD`   | Sandbox account password                             |

For a local frontend, start `pnpm dev:cloud` and use its Vite URL with
`PLAYWRIGHT_SETUP_API_URL=https://testcloud.comfy.org`. The test routes browser
API requests directly to the selected sandbox, independently of the local Vite proxy. Production targets are rejected.

The fixture disables `onboarding_survey_enabled` through the existing dev-only
feature-flag helper before navigation. Deployed builds ignore this override, so
accounts used against a deployed frontend must have completed the survey.

The smoke test signs in, validates the browser's real billing-status response,
waits for app readiness, and checks that the graph canvas is visible.
It attaches a post-login screenshot. The shared network boundary rejects mutations except the specific
POST endpoints used for Firebase sign-in/token refresh, customer provisioning,
and Cloud auth tokens/session cookies. A rejected mutation fails the test even
if the app catches the request error. Checkout, payment, and reset mutations
are blocked in both browser routing and Playwright API clients.

Use a dedicated sandbox account. Checkout recovery tests in #17481 additionally
require a personal workspace with no paid plan or saved card. Those tests own
the account preflight and direct API assertions.
