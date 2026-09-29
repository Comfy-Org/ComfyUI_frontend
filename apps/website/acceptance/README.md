# Workshop generation acceptance

These tests verify model generation. Authentication is session setup, not a
journey under test. Signup, checkout and exact billing checks are outside this
suite; changing prices do not require maintaining test charge tables.

| Workflow                     | Trigger                                           | Coverage                                                                                         |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Workshop: Live Smoke         | Production deployment, every six hours, or manual | Real browser-origin uploads and defaults/own/advanced generations on two image pages in Chromium |
| Workshop: Model Sweep        | Daily image/audio, weekly video, or manual        | Published-page defaults through the existing Router client, including output decoding            |
| Workshop: Release Acceptance | Manual                                            | Six representative model families on Chromium, WebKit and Android/iPhone emulation               |

All three run on GitHub-hosted Ubuntu against deployed production services.
Providers perform generation remotely. Paid workflows share a serial concurrency
group, do not cancel active runs, and have no automatic browser retries. Existing
PR browser tests remain offline; their configuration excludes `e2e/acceptance/`.

## Configuration

Add only these environment secrets under GitHub repository Settings →
Environments → `workshop-prod`, restricted to the protected `main` branch:

| Secret                      | Source                                                                  | Used by                                         |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| `WORKSHOP_ROUTER_API_KEY`   | A funded account's key from https://platform.comfy.org/profile/api-keys | Model Sweep and the Live Smoke upload probe     |
| `WORKSHOP_ACCOUNT_EMAIL`    | Existing funded customer's email/password account                       | Live Smoke and Release Acceptance browser setup |
| `WORKSHOP_ACCOUNT_PASSWORD` | That account's password                                                 | Live Smoke and Release Acceptance browser setup |

No expected-charge JSON, workspace ID, signup email domain, signup password or
payment-test deployment is required. Existing values for those removed settings
can be deleted. Keep credentials out of source control and chat.

The browser account needs access to Models and enough credits. Use ordinary
customer limits; the sweep's account needs concurrency of at least two. Account
funding is still operational setup: removing charge assertions does not make
provider calls free.

The browser cannot substitute a Router API key for a website login. A worker
fixture signs in once, retains cookies/local storage/IndexedDB in memory, and
seeds a fresh browser context for each generation test. Firebase can refresh
that session normally. No auth state is written into reports, and trace, video
and automatic screenshots remain disabled. Session setup failure is a failed
prerequisite, never a passed generation case.

## Assertions and evidence

Each representative page runs defaults, own inputs, and changed advanced
settings as three distinct jobs. Assertions retain accepted request IDs,
idempotency keys/body hashes, submitted prompt and advanced values, terminal
success, browser rendering/playback, download without leaving the page, and
full output decoding. The offline input checks additionally verify every media
role in the actual Router request, including inline image data and frame order.

The sweep dynamically plans at most twelve pages per shard with two concurrent
provider calls. Missing or failed pages fail its consolidated report. Artifacts
include request IDs, media metadata and sanitized reports. Browser artifacts
include downloaded media for human review. Successful decoding does not certify
prompt fidelity, edit quality or voice quality.

Smoke makes six intended generations. Release acceptance makes eighteen per
browser, seventy-two for all four profiles. The sweep makes one generation per
selected page, not per distinct Router model. Review cadence and account funding
with the owner; case counts are not dollar-spend ceilings.

Watch Actions notifications and the date of the latest completed run. Until an
external Workshop heartbeat exists, a disabled schedule will not produce a
failure notification.

## Design and QA mapping

Sources: [TDD: Comfy Workshop](https://app.notion.com/p/3cf6d73d3650811aab66ccaf03c0252f)
§7 and §13, and [Golden Paths & QA Test Cases](https://app.notion.com/p/3e26d73d3650812c9b01f0b7ea21d70e).
This suite implements the generation portion of those plans; it does not certify
the full 42-story release gate.

| Requirement                                                    | Implementation                                                                   | Boundary                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Returning customer; six model kinds                            | [generation.spec.ts](../e2e/acceptance/generation.spec.ts), [cases.ts](cases.ts) | Six representatives, three completed jobs each                                         |
| Successful generation and usable output                        | [fixtures.ts](fixtures.ts)                                                       | Live job identity, output rendering and decoding; human quality review remains         |
| Published-page defaults                                        | [model runner](../scripts/test-router-models.ts)                                 | Own/advanced inputs and every example across the entire catalogue remain separate work |
| Browser matrix                                                 | [acceptance config](../playwright.acceptance.config.ts)                          | Browser/device emulation, not physical-device certification                            |
| Signup, authentication behavior, purchases and correct billing | Existing account/billing suites outside this generation suite                    | No acceptance claim from these workflows                                               |

The scope change and alternatives are recorded in
[ADR-WEBSITE-ACCEPTANCE-0040](../../../docs/adr/WEBSITE-ACCEPTANCE-0040-generation-tests-exclude-account-and-billing-journeys.md).
See also the [model runner guide](../MODEL_TESTING.md),
[historical results grid](../MODELS_TEST_RESULTS.md), and
[offline browser guide](../e2e/README.md).

## Local verification

```sh
pnpm --filter @comfyorg/website test:unit scripts/router-model-shard.test.ts scripts/workshop-live-settings.test.ts
pnpm --filter @comfyorg/website test:e2e --project desktop e2e/workshop-acceptance-inputs.spec.ts
PUBLIC_WORKSHOP_CLOUD_ENV=prod pnpm --filter @comfyorg/website test:router-models --plan --max-cases 12
```

Build the offline site using `e2e/README.md` before browser tests. For live browser
runs, inject the email/password plus `WORKSHOP_SITE_URL=https://comfy.org`,
`PUBLIC_WORKSHOP_CLOUD_ENV=prod`, `WORKSHOP_FIXTURE_DIR` (temporary directory),
and `WORKSHOP_ACCEPTANCE_SCOPE=smoke|release`. Install ffmpeg/ffprobe and browsers:

```sh
pnpm --filter @comfyorg/website test:acceptance --project chromium
```

`--list` collects tests without credentials; it is not executed acceptance.
Non-production origins remain disallowed until explicitly reviewed in
`settings.ts`. The standard workflows require no non-production deployment.

`queue: max` uses [GitHub's supported concurrency syntax](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
Older actionlint schemas may flag it as unknown.
