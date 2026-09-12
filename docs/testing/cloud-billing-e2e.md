# Real Cloud checkout recovery

Run the opt-in `cloud-live` project through the existing browser-test runner:

```sh
pnpm test:browser:cloud-billing --headed
pnpm exec playwright show-report
```

Set these variables using the existing `.env` convention or inject them with
`op run --env-file <file-with-secret-references> -- pnpm test:browser:cloud-billing`:

| Variable                   | Value                                                |
| -------------------------- | ---------------------------------------------------- |
| `PLAYWRIGHT_TEST_URL`      | Local frontend URL or deployed sandbox origin        |
| `PLAYWRIGHT_SETUP_API_URL` | Matching test, staging, or PR sandbox backend origin |
| `CLOUD_ACCOUNT_EMAIL`      | Sandbox account email                                |
| `CLOUD_ACCOUNT_PASSWORD`   | Sandbox account password                             |

For repeated local runs, open one credential shell and run all test commands
inside it. This reuses credentials already loaded by 1Password instead of
requesting them again for each command:

```sh
op run --env-file <file-with-secret-references> -- zsh -f
pnpm test:browser:cloud-billing
```

Keep the shell open for the session. Exiting it ends credential reuse. The env
file contains 1Password references, not passwords.

For a local frontend, start `pnpm dev:cloud` and use its Vite URL with
`PLAYWRIGHT_SETUP_API_URL=https://testcloud.comfy.org`. The test routes browser API requests and its API checks directly to the selected
sandbox, independently of the local Vite proxy. Production targets are rejected.

The fixture disables `onboarding_survey_enabled` through the existing dev-only
feature-flag helper before navigation. Deployed builds ignore this override, so
accounts used against a deployed frontend must have completed the survey.

The account must own a personal workspace with no active paid subscription or saved
payment method. Use an account reserved for this test. Do not run concurrent
billing tests against that account.

The test signs in, checks the real preview and payment dialog are ready, opens
Stripe test checkout, closes it without entering a card, and resumes the same
pending billing operation. The report attaches screenshots and the operation ID.
Authentication traces and saved credentials are not retained.

No database, Stripe secret key, or Temporal access is required. Closing the
browser leaves the unpaid checkout pending in the backend. The test does not
reset billing state or claim that the operation expired. The first action accepts either a fresh Subscribe button or the pending
Complete your payment button, so sequential runs can resume an existing checkout. Backend expiry and fixture reset remain separate work.

The no-card tests cover checkout handoff, retry, page reload, and signing in
from an empty browser context. Payment completion, the 24-hour timeout, and
CI integration remain follow-up work. A
successful sign-in alone does not establish billing coverage.

## Saved-card billing

`pnpm test:browser:cloud-billing:paid` runs the separate `cloud-live-paid`
project. Inject the saved-card account credentials into `CLOUD_ACCOUNT_EMAIL`
and `CLOUD_ACCOUNT_PASSWORD`. This project requires an active Creator plan and
at least one saved sandbox payment method. It purchases $10 of test credits and
checks the completed billing operation, exact balance increase, and success UI.
The balance API returns cents despite its `amount_micros` field name. Never
point this command at the no-card account.
