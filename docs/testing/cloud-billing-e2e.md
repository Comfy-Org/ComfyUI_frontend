# Real Cloud billing E2E

These opt-in Playwright projects run the local frontend against a matching
Cloud sandbox and Stripe test mode. They reject production targets and
serialize billing mutations per workspace.

## Accounts

| Account            | Reserved state                                    | Project                 |
| ------------------ | ------------------------------------------------- | ----------------------- |
| No-card account    | Personal workspace, no paid plan or saved card    | `cloud-live`            |
| Saved-card account | Active Creator plan and saved Stripe test card    | `cloud-live-paid`       |
| Disposable account | Created per state-changing test                   | `cloud-live-disposable` |
| Team owner         | Team billing owner with a personal workspace      | Blocked                 |
| Team member        | Member of the same team with a personal workspace | Blocked                 |

Never add a card to the permanent no-card account. Use disposable accounts for
checkout completion, card failure, 3D Secure, and subscription transitions.
Never run billing mutations concurrently against one workspace.

## Run

Start the Cloud frontend and keep one 1Password credential shell open:

```sh
pnpm dev:cloud
op run --env-file <file-with-1password-references> -- zsh -f
```

Set `PLAYWRIGHT_TEST_URL` to the local Vite origin and
`PLAYWRIGHT_SETUP_API_URL=https://testcloud.comfy.org`. Permanent-account
projects also require `CLOUD_ACCOUNT_EMAIL` and `CLOUD_ACCOUNT_PASSWORD`.
The env file must contain 1Password references, never plaintext passwords.

```sh
pnpm test:browser:cloud-billing
pnpm test:browser:cloud-billing:paid
pnpm test:browser:cloud-billing:disposable
pnpm exec playwright show-report
```

The disposable project creates a fresh Firebase account and lazily provisions
its personal workspace through the public billing portal endpoint. It requires
no reusable account credentials.

The fixture disables `onboarding_survey_enabled` through the dev-only feature
flag helper. Deployed frontends ignore this override, so their accounts must
have completed onboarding.

## Coverage contract

| Priority | Scenario                                                                              | Spec                                                      | Current sandbox proof              |
| -------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| P0       | Abandon, retry, reload, and fresh-context recovery reuse one pending operation        | `checkoutRecovery.spec.ts`, `checkoutPersistence.spec.ts` | Pass, 3 tests                      |
| P0       | Checkout completion activates Creator and grants the quoted credits exactly once      | `disposable/checkoutCompletion.spec.ts`                   | Pass                               |
| P0       | Saved-card top-up completes with the exact balance increase and success UI            | `paid/savedCardTopup.spec.ts`                             | Pass                               |
| P0       | Retrying one top-up reuses its operation and grants once                              | `paid/topupIdempotency.spec.ts`                           | Pass                               |
| P1       | A declined card leaves the account inactive with no credit change                     | `disposable/cardDecline.spec.ts`                          | Pass                               |
| P1       | Retrying after decline activates Creator and grants the exact quote                   | `disposable/cardDeclineRecovery.spec.ts`                  | Pass                               |
| P1       | Successful 3D Secure activates only after authentication                              | `disposable/threeDSComplete.spec.ts`                      | Blocked: operation remains pending |
| P1       | Failed 3D Secure stays inactive and becomes retryable                                 | `disposable/threeDSFailure.spec.ts`                       | Blocked: operation remains pending |
| P1       | Team owner can mutate billing; member and cross-workspace writes are rejected         | No executable spec                                        | Blocked: team fixture              |
| P2       | Creator upgrades to Pro now and schedules a Standard downgrade without an extra grant | `disposable/planTransitions.spec.ts`                      | Pass                               |
| P2       | Cancellation schedules the end and reactivation clears it without changing balance    | `disposable/cancelReactivate.spec.ts`                     | Pass                               |
| P2       | Renewal, credit reset, pending-checkout expiry, and subscription expiry converge      | No executable spec                                        | Blocked: clock control             |
| P2       | Delayed, failed, duplicate, and out-of-order events converge without duplicate grants | No executable spec                                        | Blocked: fault control             |

Keep blocked assertions strict. The two 3D Secure specs are executable gap
reproductions and should turn green only when the Cloud operation reaches its
expected terminal state.

## Required sandbox controls

### Team fixture

Provide two service-owned accounts in one resettable Team workspace. The owner
must have a saved Stripe test card and an active Team subscription. Both users
must also retain personal workspaces. Setup must restore membership, roles,
active workspace, subscription, and ledger balance before the suite. The tests
must prove that owner writes succeed, member writes receive authorization
errors, and selecting another workspace cannot mutate the Team ledger.

### Clock control

Provide a sandbox-only API that creates or resets a disposable billing customer
under a Stripe test clock, advances it to a requested boundary, and waits until
Cloud webhook and Temporal processing reach a stable checkpoint. It must cover
renewal, credit reset, pending-checkout expiry, and subscription expiry. Return
the workspace, billing operation, event, and clock identifiers for assertions.
Advancing a Stripe clock alone is insufficient.

### Fault control

Provide a sandbox-only, operation-scoped fault API with automatic expiry. It
must delay or fail a named billing phase once, replay duplicate and out-of-order
events, and report delivery and retry attempts. Tests must then require one
terminal operation, one charge, one ledger grant, and eventual UI and backend
agreement.

## Evidence and safety

Retain operation IDs, expected and observed balances, status projections,
screenshots, and blocked-egress attachments in the Playwright report. Exclude
credentials, authorization headers, cookies, and payment secrets. Basic runs
need no database, Stripe secret key, or Temporal admin access. Team, clock, and
fault cases remain blocked until the sandbox exposes the scoped controls above.
