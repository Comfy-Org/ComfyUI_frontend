# Billing reads and parity

Six billing reads populate every credits and plan surface in the app: status, balance, plan catalog, capabilities, saved payment methods, and the usage log. Turning on _either_ write rail moves all six onto the SDK readers, so this is the feature that changes even in a scenario that only enables subscription. The migration is correct only if a customer cannot tell which rail served them.

## Sub-features

- `read-status` subscription status, with plan name, state, and renewal or end date.
- `read-balance` credits total, and the monthly vs prepaid breakdown where shown.
- `read-plans` the plan catalog offered in the pricing table.
- `read-capabilities` what the workspace is allowed to do; gates CTAs.
- `read-payment-methods` the saved-card note in the top-up and checkout dialogs.
- `read-events` the usage log, including pagination.
- `read-first-paint` the rail is chosen before the first read leaves the page.
- `read-parity` every value above is identical across S0/S1/S2/S3.
- `read-scoping` values follow the active workspace and never leak across a switch.

## How to get to it (user POV)

- Open the user popover in the top bar. Credits total and plan are shown there.
- `Settings` → `Plan & Credits` shows status, balance, plan catalog, and saved card.
- `Settings` → `Plan & Credits` → `Activity` shows the usage log, with `Next Page`.
- Switch workspace from the workspace switcher.

## Driving it with the cloud-live Playwright project and the browser

Preconditions:

- Doctor passes; signed in as an email-verified `@comfy.org` user.
- `flags.unifiedCloudAuthEnabled` resolves `true`. Check it, do not assume it. Every rail is ANDed with it, and the anonymous remote config reports it `false` in all three environments.
- A fresh tab per scenario.

- **Baseline capture (S0).** Load with no query string. Open `Settings` → `Plan & Credits`. Record credits total, plan name, renewal date. Open `Activity` and record the first three rows. Save to `temp/verify-evidence/S0/reads.md`. This is the control for every comparison below.
- **Rail chosen before first read.** Open DevTools Network _before_ loading with a rail on, then load `?ff=billing_sdk_topup_enabled`. The very first `/api/billing/status` and `/api/billing/balance` must already be resourceType `fetch` on the `/api/billing/*` path. SDK reads carry no `Idempotency-Key`; the SDK sends it only on writes. An `xhr` first read means the flags arrived after boot and the rail was not actually under test.
- **Six reads on the SDK.** With a rail on, walk every entry point above and confirm each of the six requests is `fetch`. `Settings` → `Plan & Credits` covers status, balance, plans, capabilities and payment methods; `Activity` covers events.
- **Value parity.** Repeat the baseline capture under S1, S2 and S3. Credits total, plan name, renewal date and the first three usage-log rows must be identical to S0, with the same events, the same amounts, and the same order.
- **Credits breakdown.** With a rail on, check the monthly vs prepaid split where shown adds up to the same total as S0.
- **Plan catalog parity.** With a rail on, open the plan picker. Same plans, same prices, same credit amounts as S0.
- **Saved card parity.** With a rail on, open the top-up dialog. Same card brand and last four as S0.
- **Read stability.** Hard-reload `Settings` → `Plan & Credits` five times with a rail on. The credits total is the same every time and never flashes zero or blank.
- **Pagination.** In `Activity`, choose `Next Page`. Page 2 shows different rows than page 1, on both rails.
- **Workspace scoping.** Switch from workspace A to B. Credits, plan and usage log all change to B and **no rows from A remain on screen**. Repeat while the usage log is still loading. A's rows must not appear under B's name. Switch to a workspace with no subscription and confirm the unsubscribed state renders rather than the previous workspace's plan.
- **Session boundary.** Sign out and back in with a rail on; credits and plan reload under the correct account. Leave the tab idle a few minutes, interact again, and confirm billing state is still correct with no duplicate polling.
- **Proof.** For each scenario save the request table (resourceType and path per `/api/billing/*` call, plus `Idempotency-Key` for writes) and a screenshot of `Plan & Credits` to `temp/verify-evidence/<scenario>/`.

## Gotchas

- **`fetch` alone does not prove the SDK rail. Check the path too.** A legacy personal workspace reads its balance from `https://<api-host>/customers/balance`, cross-origin and on `fetch`. The SDK rail is `fetch` + a `/api/billing/*` path. See `useBillingRouting.ts:17-42` (`shouldUseWorkspaceBilling`), the axis orthogonal to the rail.
- **Run the matrix on a workspace-billing account.** With both SDK flags ON, a legacy personal workspace still reads `/customers/balance`; nothing about the rail is under test there.
- **Switching workspace reloads the whole app**, so cross-workspace row leakage cannot happen in-page on this build. Re-check if switching ever becomes client-side.
- `read-parity` is the single most important section in the migration. A rail that works but returns a different number is worse than a rail that fails loudly.
- Capabilities are scope-checked: the SDK reader discards a payload whose `resolved_for` does not match the active user and workspace, and every capability then reads false. A blanket-false capability screen is more likely a scope mismatch than a real permission change.
- `Settings` → `Plan & Credits` opens a dialog inside a dialog. Scope locators to the dialog that contains the expected heading; the generic `role="dialog"` matches both stacked roots at once.
- The usage log is the only read backed by pagination, so a parity check on page 1 alone does not cover it.
- Reads follow _either_ write flag. In S2, do not expect the reads to be legacy just because top-up is.
