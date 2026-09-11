# Real Cloud checkout recovery

Run this through the existing `browser_tests` Playwright runner. The `cloud`
project supplies mock billing responses; `cloud-live` signs in through the real
Cloud login page and sends real preview, subscribe, and operation-status requests.

The opt-in command enables only `cloud-live`, with one worker and no retries:

```sh
pnpm test:browser:cloud-billing --headed
pnpm exec playwright show-report
```

The test checks the displayed amount against the real preview, opens Stripe test
checkout without entering a card, closes it, and resumes the same pending billing
operation. The HTML report includes screenshots of the preview, Stripe checkout,
and resume button. Authentication traces, videos, and storage files are not saved.
This does not test payment completion, page-reload recovery, or the 24-hour timeout.

## Environment

Use the existing `.env` convention. Do not commit credentials.

| Variable                   | Value                                                                     |
| -------------------------- | ------------------------------------------------------------------------- |
| `PLAYWRIGHT_TEST_URL`      | Frontend URL, such as `http://localhost:5173`                             |
| `PLAYWRIGHT_SETUP_API_URL` | `https://testcloud.comfy.org`, staging, or a PR sandbox origin            |
| `CLOUD_ACCOUNT_EMAIL`      | Dedicated sandbox account, following Cloud's E2E account convention       |
| `CLOUD_ACCOUNT_PASSWORD`   | That account's password                                                   |
| `SMOKE_DB_DSN`             | Database for the same sandbox, following Cloud's billing smoke convention |
| `SMOKE_STRIPE_TEST_KEY`    | Stripe `sk_test_` key for that sandbox                                    |
| `TEMPORAL_ADDRESS`         | That sandbox's Temporal endpoint                                          |
| `TEMPORAL_NAMESPACE`       | That sandbox's Temporal namespace                                         |
| `TEMPORAL_API_KEY`         | Required for Temporal Cloud; omit for a local connection                  |

For a local frontend connected to test Cloud:

```sh
pnpm dev:cloud
```

In another terminal, run the test with `PLAYWRIGHT_TEST_URL` set to that Vite
server and `PLAYWRIGHT_SETUP_API_URL=https://testcloud.comfy.org`. The frontend
server must proxy to this same backend. For staging or preview, use the matching
backend when starting the dev server, or point both URLs at the deployed sandbox.
Production targets and live Stripe keys are rejected.

The sandbox must use the Temporal billing engine with checkout-abandonment signal
support. The account must own a personal workspace with inactive billing, no saved cards,
no active or scheduled subscriptions, and no pending billing operation. Provision
this identity separately from shared smoke accounts. The test refuses to repair
pre-existing state. GitHub frontend secrets include `CLOUD_TEST_EMAIL` and
`CLOUD_TEST_PASSWORD`, but their account suitability has not been verified.

## Cleanup

The fixture takes a database advisory lock for the workspace. Before allowing
Subscribe, it checks the database state, verifies the Stripe customer is in test
mode, and checks access to the Temporal namespace. A second run using this fixture
cannot use the same workspace concurrently. Other tools must not use this account.

After the test, including assertion failures, cleanup:

1. Expires only Stripe test checkout sessions created for this customer during
   the run.
2. Finds operations created during the run and requires unpaid initial
   subscriptions owned by Temporal.
3. Sends `subscription_checkout_abandoned` to those operations' workflows, waits
   for terminal failure, and verifies their subscriptions ended.
4. Restores inactive workspace billing only if no pending operations or non-ended
   subscriptions remain, emitting the backend's `projection_dirty` outbox event
   in the same transaction.
5. Reads the public billing API again to verify inactive billing and no cards.

Cleanup refuses unexpected paid state. A cleanup failure fails the run and means
the account requires investigation before reuse. Process termination can prevent
teardown, so do not share the identity. Cleanup is fixture maintenance, not evidence
that the product's timeout or abandonment behavior is correct.

## Validation status

The live checkout journey has not yet passed. Local sandbox credentials and
backend cleanup access are still required. Test collection and prerequisite
validation do not establish real Cloud coverage.
