# ComfyUI Cloud verification map

This directory is the maintained source for verifying user-facing cloud behaviour. Read this index before driving the app, then use the matching feature file as the recipe. `../SKILL.md` holds Launch, Doctor, Drive, Evidence and Cleanup.

The current focus is the **billing SDK rail migration** (Milestone 1): every billing read and write has two transports, a feature flag picks one, and the UI is identical on both. A failure here is not a different screen. It is a hang, a wrong number, a double charge, or a purchase never reported as finished.

## Baseline preconditions

- Launch at `http://localhost:5173` with `nvm use 26 && pnpm dev:cloud` (backend: `testcloud.comfy.org`).
- Run all four Doctor checks. In particular, confirm both `curl -s http://localhost:5173/src/composables/useFeatureFlags.ts | grep -c billing_sdk_topup_enabled` and the same with `billing_sdk_subscription_enabled` are non-zero. A build that carries only one of them cannot run S2 or S3. An environment without the migration makes every result below meaningless.
- Sign in with an **email-verified `@comfy.org`** account. Without it `?ff=` overrides are silently ignored. The human signs in; never type someone's password.
- Have ready: an account with a saved card, one without, a declining card, a 3DS card, and both a personal and a team workspace.
- Never drive an instance this run did not start.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names, then `data-testid`, over CSS or DOM position. Reuse the page objects in `browser_tests/fixtures/components/`.
- **Open a fresh tab when changing scenario.** `?ff=` is captured per tab, keyed on the query string, and survives reloads.
- Read a flag by resolving it, never by reading `sessionStorage`. Storage shows captured overrides that the employee gate then discards.
- Automated read-only passes go through the `cloud-live` Playwright project, which blocks every billing mutation by allowlist. Anything that pays is clicked by a human.

## The scenario matrix

Both rails are ANDed with `unified_cloud_auth`. The anonymous `/api/features` reports it `false` in every environment, but it resolves `true` for a signed-in user. Resolve `flags.unifiedCloudAuthEnabled` in the page before trusting a scenario, and do not override it. Forcing it on with the dev `ff:unified_cloud_auth` key put the local app into a reload loop on 2026-09-21 (`workflows` 403, subscription status `NOT_AUTHENTICATED`). Override only the billing flags.

| #   | Query string                                                        | What it is                                               |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| S0  | _(none)_                                                            | Legacy baseline. Record the numbers here.                |
| S1  | `?ff=billing_sdk_topup_enabled`                                     | Top-up + all reads on the SDK                            |
| S2  | `?ff=billing_sdk_subscription_enabled`                              | Subscription + all reads on the SDK; top-up still legacy |
| S3  | `?ff=billing_sdk_topup_enabled&ff=billing_sdk_subscription_enabled` | End state                                                |

Turning on _either_ write flag moves all six reads onto the SDK readers. Leave `embedded_checked_enabled` and `hosted_billing_destination` alone. They are separate rollouts with their own gates.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof: an ARIA snapshot plus a screenshot with the app identity visible.
- Network proof: resourceType and path for every `/api/billing/*` request, including the first read of the page load, and `Idempotency-Key` for every write.
- Mutation proof: a second, read-only view of the stored value (reload and re-read the balance; open the usage log).
- Record the scenario ID with every artifact, under `temp/verify-evidence/<scenario>/`.
- Report an unreachable path with the attempted step and the unmet precondition. **Do not report a skipped entry point as verified through a different path.** If embedded checkout is not run, it is unvalidated, not covered.

## Feature entry contract

Each feature file opens with an H1 and one paragraph of user-visible behaviour, then exactly four H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, `Gotchas`. Keep implementation detail out; name only user paths, stable handles, required state, commands and observable proof.

## Features

- [Buy credits (top-up)](./top-up.md) covers presets, custom amount, saved vs no card, decline, pending reload, double purchase.
- [Subscription lifecycle](./subscription-lifecycle.md) covers subscribe, plan change, cancel, resume, manage-billing portal, team downgrade.
- [Billing reads and parity](./billing-reads.md) covers the six reads, value parity across rails, workspace scoping.
- [Operation recovery and bank verification](./operation-recovery.md) covers pending-op pickup on reload, 3DS complete/abandon/retry/fail.
