# Workshop live acceptance

Find these workflows together under **Workshop:** in GitHub Actions:

| Workflow                     | Trigger                                                                                    | Target and coverage                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workshop: Live Smoke         | Successful production website deployment, every six hours at minute 43, or manual dispatch | Production browser-origin upload probe; an ordinary customer runs default, own-input, and advanced-input jobs on an image generator and an image editor in Chromium         |
| Workshop: Model Sweep        | Daily 06:17 UTC for image/audio, Sunday 07:17 UTC for video, or manual dispatch            | Every currently published media page's defaults, using the existing Node Router client and real providers                                                                   |
| Workshop: Release Acceptance | Manual dispatch                                                                            | All six model families on Chromium, WebKit, Android Chrome emulation, and iPhone WebKit emulation; a separate checkout selection runs new-buyer journeys against test Cloud |

The runner is GitHub-hosted Ubuntu. Generation happens on the deployed Router
and provider infrastructure, not on the runner. Checkout uses Stripe test mode.
No paid job runs on PR events. Dispatches must use `main`. Existing website PR
tests remain offline and continue running in `CI: Website E2E`.

Paid production workflows share one concurrency group, do not cancel active
jobs, and queue pending runs. Browser workers and matrix jobs run serially.
The sweep allows two provider calls at once and allocates at most twelve
pages per shard, calculated from the current catalogue. A shard has a
355-minute job limit; its twelve 45-minute case budgets at concurrency two
leave time for setup and evidence upload. Failed or missing pages fail the
consolidated coverage job. There are no automatic Playwright retries.

## Design and QA traceability

The design sources are [TDD: Comfy Workshop](https://app.notion.com/p/3cf6d73d3650811aab66ccaf03c0252f),
especially sections 7 (UX journeys) and 13 (Testing), and the newer
[Workshop Models — Golden Paths & QA Test Cases](https://app.notion.com/p/3e26d73d3650812c9b01f0b7ea21d70e).
The [Models V1 rollout QA plan](https://app.notion.com/p/3db6d73d3650813685c1e8a0703a75e5)
provides earlier manual checks. The table maps implemented assertions, not
executed live passes; every live journey remains unverified until its workflow
runs successfully with the configured accounts and environment.

| Design or QA requirement                                                         | Implementation                                                                                                                                                                                                                                                    | Remaining acceptance work                                                                                                                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TDD §7 Journey 1; QA “New visitor to first result”                               | [purchase.spec.ts](../e2e/acceptance/purchase.spec.ts): email signup from an edited image page, personal workspace ownership, test purchase, exact credit settlement, prompt restoration, first generation and download                                           | Browse/search entry, other signup methods, explicit asset/settings restoration assertions, eligibility timing and actual sandbox execution                      |
| TDD §7 Journey 2; QA “Returning customer” and “Running each kind of model”       | [generation.spec.ts](../e2e/acceptance/generation.spec.ts), [cases.ts](cases.ts): six representatives each run defaults, own inputs and advanced settings as three distinct jobs                                                                                  | All published page/mode combinations, another changed prompt/asset after the own-input run, and visual confirmation of input influence                          |
| QA “What every successful run must prove”                                        | [fixtures.ts](fixtures.ts): accepted job identity, prompt/advanced request values, terminal success, browser rendering/playback, downloaded media decoding, isolated effective balance delta                                                                      | Every uploaded asset role in sanitized request evidence, requested count/dimensions/duration assertions, per-job ledger reconciliation and human quality review |
| QA inventory and release gate: every published page/mode                         | [test-router-models.ts](../scripts/test-router-models.ts), [Model Sweep](../../../.github/workflows/workshop-model-sweep.yaml): dynamic published-default inventory, bounded shards and failure on missing results                                                | Own-input/advanced cases for every page, every runnable example and production execution                                                                        |
| TDD §13; QA deployment smoke and release browser matrix                          | [Live Smoke](../../../.github/workflows/workshop-live-smoke.yaml), [Release Acceptance](../../../.github/workflows/workshop-acceptance.yaml), [Playwright config](../playwright.acceptance.config.ts): separate live runner, Chromium/WebKit and mobile emulation | Actual Actions runs, real-device Safari, keyboard/accessibility checks and external heartbeat monitoring                                                        |
| TDD §7 Journeys 3–5; QA invalid inputs, policy, retry, concurrency and isolation | No new live acceptance coverage in this slice; existing offline tests retain their own scope                                                                                                                                                                      | Developer hand-off, team-member billing gates, controlled faults, recovery, policy fixtures and account/workspace separation                                    |

The newer QA plan expands the TDD's single staging browser journey into real
production acceptance and a supported payment sandbox. The old documents'
synchronous API, checkout destination and cancellation/billing descriptions
are not treated as current contracts: these tests use the current asynchronous
Router path and do not assume that cancellation or timeout means no charge.

Related repository documentation:

- [ADR-WEBSITE-ACCEPTANCE-0036](../../../docs/adr/WEBSITE-ACCEPTANCE-0036-separate-live-customer-tests-from-offline-ci.md): runner boundaries, account isolation and rejected alternatives.
- [Model runner guide](../MODEL_TESTING.md) and [historical results grid](../MODELS_TEST_RESULTS.md): request-path coverage and evidence; historical results are not passes for these new workflows.
- [Offline browser guide](../e2e/README.md): local build and mocked PR checks, including [acceptance input checks](../e2e/workshop-acceptance-inputs.spec.ts).

## Configure before activation

Create GitHub environments `workshop-prod` and `workshop-test`, restricted to
the repository's protected `main` branch. Configure credentials through the
secret manager/GitHub settings, never in files or chat. Missing settings fail
preflight rather than producing a skipped green acceptance run.

Before using a staging or test deployment, verify its ownership and backend,
then add its exact HTTPS origin to the matching `approvedSiteOrigins` entry
in `settings.ts` through review. Those lists start empty; arbitrary Vercel
hostnames, non-default ports and unapproved deployments are rejected before
the browser starts. Setting `WORKSHOP_TEST_SITE_URL` alone is insufficient.

| Setting                          | Kind                          | Purpose                                                                                                                   |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `WORKSHOP_ACCOUNT_EMAIL`         | Environment secret            | Dedicated existing external customer for generation acceptance                                                            |
| `WORKSHOP_ACCOUNT_PASSWORD`      | Environment secret            | Its real sign-in credential                                                                                               |
| `WORKSHOP_WORKSPACE_ID`          | Environment variable          | Exact personal workspace that sign-in must select                                                                         |
| `WORKSHOP_ROUTER_API_KEY`        | Production environment secret | Separate funded customer for the catalogue sweep and browser-origin upload probe                                          |
| `WORKSHOP_EXPECTED_CHARGES_JSON` | Environment variable          | Reviewed US cents per `model-page-slug/input-variant`; see below                                                          |
| `WORKSHOP_TEST_SITE_URL`         | Test environment variable     | Deployed Vercel website built with `PUBLIC_WORKSHOP_CLOUD_ENV=test`, with its origin allowed by test auth/storage/billing |
| `WORKSHOP_SIGNUP_EMAIL_DOMAIN`   | Test environment variable     | Team-owned domain for disposable new-customer addresses                                                                   |
| `WORKSHOP_SIGNUP_PASSWORD`       | Test environment secret       | Password satisfying the signup policy for those disposable customers                                                      |

Use ordinary non-staff customers. The acceptance account must have its normal
finite concurrency limit, no unrelated activity, enough
credits, and the real Workshop feature flag enabled. The separate sweep
customer needs a finite limit of at least two. Do not use the unlimited
concurrency override from the older manual model-sweep instructions to certify
ordinary-customer behavior. Assign an owner for funding and cleanup of test
accounts and stored/generated assets.

`WORKSHOP_EXPECTED_CHARGES_JSON` is an object whose keys are the slugs in
`cases.ts`, followed by `/defaults`, `/own`, or `/advanced`, and whose values
are positive US cents, including fractional cents. For example, a reviewed
$0.045 charge would be `4.5`; that example is not a claim about any model's actual price.
The API fields named `_micros` carry cents; use `effective_balance_micros`
with `amount_micros` as its fallback. Pending draft-invoice usage is valid and
is already subtracted in the effective balance. Get the amounts from the billing
contract for the exact submitted settings,
not from a first run that might itself be overcharging. Checkout needs the
two image models' `/own` entries; smoke needs all three variants for those
models; release generation needs all eighteen entries.

The browser suite checks the selected workspace, one idempotency key and body
per intended job, a real accepted job ID, terminal success, browser playback,
download without losing the page, full media decoding, and the effective balance
delta within 0.0000005 cents. The isolated account is essential: the delta is not a
per-request ledger lookup. A new customer's sandbox $10 top-up must credit
exactly $10 before the first run. The test verifies `cs_test_` and the Stripe
checkout origin before entering the documented Stripe test card.

Fresh-account checkout requires the deployed signup flow to permit automated
test customers. It does not bypass Turnstile, email verification, or other
identity controls. An environment that cannot complete this flow is blocked,
not a passed first-purchase journey. Disposable accounts and their remaining
test credits are retained for investigation; the environment owner must clean
them up through the established account lifecycle.

## Evidence and spending

Smoke makes six intended generations. A complete generation acceptance run
makes eighteen per browser, seventy-two over all four profiles. Checkout makes
two test purchases and two generations per browser. The catalogue sweep makes
one generation per selected published page, not per unique Router model ID.
Provider calls on test Cloud may still cost money. Set a funding budget for the
dedicated accounts and review cadence with the owners before enabling schedules.
Case-count limits are not a dollar-spend ceiling.

The model sweep publishes a consolidated JSON report and a page/result table
in the Actions summary. Per-shard artifacts include the source revision,
request IDs, output hashes, decoded dimensions/durations, and failure states.
Browser reports include accepted-job evidence before waiting for completion,
so a failed or interrupted test can be reconciled without submitting another
paid job. Browser artifacts retain downloaded media for human inspection.
Traces, video recordings, storage-state files, and automatic screenshots are
disabled because authentication and checkout carry credentials.

Watch the three workflows through Actions notifications. A cron can be disabled
without a failing run: until Workshop has its own external heartbeat monitor,
the release owner must check the date of the last completed sweep, not merely
its green badge. Cloud's existing Router SDK heartbeat does not establish that
these website workflows ran.

## Local verification

The existing unit and offline browser suites exercise destination/budget
validation, shard coverage, and the acceptance form interactions without paid
calls:

```sh
pnpm --filter @comfyorg/website test:unit scripts/router-model-shard.test.ts scripts/workshop-live-settings.test.ts
pnpm --filter @comfyorg/website test:e2e --project desktop e2e/workshop-acceptance-inputs.spec.ts
```

Build the offline test site using `e2e/README.md` before running its browser
tests. For a free catalogue plan, without writing evidence or calling providers:

```sh
PUBLIC_WORKSHOP_CLOUD_ENV=prod pnpm --filter @comfyorg/website test:router-models --plan --max-cases 12
```

For a real browser run, inject the settings above plus `WORKSHOP_SITE_URL`,
`PUBLIC_WORKSHOP_CLOUD_ENV`, `WORKSHOP_FIXTURE_DIR` (a temporary directory), and
`WORKSHOP_ACCEPTANCE_SCOPE=smoke|release|checkout`. Install ffmpeg/ffprobe and
Playwright browsers. Then run:

```sh
pnpm --filter @comfyorg/website test:acceptance --project chromium
```

Do not interpret `--list` as executed acceptance. The config can be collected
without credentials, but global setup validates them before a test starts.

## Coverage boundary

This is the first automated live acceptance slice, not certification of all
42 stories in the QA document. The catalogue sweep covers defaults across all
published pages; own-input and advanced browser jobs cover the six reviewed
representatives in `cases.ts`. All-page own-input/advanced inventories, every
runnable example, additional authentication methods, real-device Safari,
workspace isolation, fault injection, policy fixtures, and recovery after
refresh still need their dedicated acceptance cases. WebKit device emulation
is not a physical iPhone/Safari test.

Human review must confirm prompt fidelity, recognizable transformations,
speech/voice quality, and vendor policy applicability. Successful decoding does
not prove those properties; each evidence record explicitly leaves visual
review unexecuted. Test failures must not be converted to success for provider
outages. Record blocked models and release exceptions in the QA matrix.

`queue: max` follows GitHub's documented concurrency syntax. If actionlint
reports only that key as unknown, its schema predates the supported feature;
do not remove the queue and silently replace pending paid runs.
See https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency.
