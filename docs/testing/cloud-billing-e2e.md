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

## Cancellation retention offer

The current Cloud retention coupon runs for the server-supplied number of
calendar months starting at acceptance. It does not guarantee that many future
discounted renewals. For example, acceptance on February 28 can expire May 28,
so a May 31 renewal is already full price. Show regular and discounted monthly
rates, without a guaranteed total saving or a date calculated from `period_end`.
The offer applies to the current plan; changing plans may end the discount.

`RetentionAcceptance` exposes only `billing_op_id` and `status`.
`RetentionFlowSubscription.period_end` is the next renewal, and the flow's
`expires_at` is the cancellation session's expiry. Neither is the applied
coupon's expiry. Confirmation therefore describes the accepted duration without
a date. To show an authoritative expiry, Cloud must expose the applied
`RetentionReceipt.ends_at` as optional `retention_discount_ends_at` (Unix
seconds) on `BillingOpStatusResponse`, only for succeeded retention operations,
including replay of an already completed operation. The frontend can read it
using `billing_op_id` after either immediate success or polling. Regenerate the
ingest types and Zod schemas before consuming that field. Pending operations
must not supply a guessed date.

`RetentionOfferStep.test.ts` covers the offer and applied states, server-provided
percent and duration, singular/plural copy, and month-end acceptance. There are
no retention-flow Storybook stories; this component owns billing orchestration.
Translated messages are generated on release from `src/locales/en/main.json`,
as described in `CONTRIBUTING.md`.
