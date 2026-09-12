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

For a local frontend, start `pnpm dev:cloud` and use its Vite URL with
`PLAYWRIGHT_SETUP_API_URL=https://testcloud.comfy.org`. The local server must
proxy to the selected sandbox. Production targets are rejected.

The fixture disables `onboarding_survey_enabled` through the existing dev-only
feature-flag helper before navigation. Deployed builds ignore this override, so
accounts used against a deployed frontend must have completed the survey.

The account must own a personal workspace with no active paid subscription or saved
payment method. Use an account reserved for this test. Do not run concurrent
billing tests against that account.

The test signs in, checks the displayed amount against the real preview, opens
Stripe test checkout, closes it without entering a card, and resumes the same
pending billing operation. The report attaches screenshots and the operation ID.
Authentication traces and saved credentials are not retained.

No database, Stripe secret key, or Temporal access is required. Closing the
browser leaves the unpaid checkout pending in the backend. The test does not
reset billing state or claim that the operation expired. A subsequent run may
resume the pending operation if the backend permits it; otherwise use a fresh
no-card test account. Backend expiry and fixture reset remain separate work.

The first test covers checkout handoff and retry. Payment completion, page-reload
recovery, the 24-hour timeout, and CI integration remain follow-up work. A
successful sign-in alone does not establish billing coverage.
