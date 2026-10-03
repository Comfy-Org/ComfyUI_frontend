# Buy credits (top-up)

A user adds credits to the active workspace by choosing a preset or typing an amount, then paying. Payment runs on a saved card, or on the provider's hosted page when none is saved. The purchase is a billing operation the app must follow to completion, including across a reload.

## Sub-features

- `topup-open` reaches the dialog from every entry point.
- `topup-presets` the $10 / $25 / $50 / $100 presets and the custom amount field.
- `topup-saved-card` pays with the saved card and lands the credits.
- `topup-hosted` no saved card, pays on the provider page, balance updates on return.
- `topup-decline` a declining card fails clearly and leaves the balance unchanged.
- `topup-reload` a purchase still pending survives a page reload.
- `topup-abandon` closing the payment tab without paying does not strand the dialog.
- `topup-double` two purchases in quick succession charge once each.
- `topup-workspace` credits land in the workspace the purchase started in.

## How to get to it (user POV)

- User popover in the top bar → `Add credits`.
- `Settings` → `Plan & Credits` → `Add credits`.
- The insufficient-credits prompt raised when a run cannot be afforded (heading `Add more credits to run`).
- The `?topup=1` deep link.

## Driving it with the browser (payments) and Playwright (everything else)

Preconditions:

- Doctor passes; signed in as an email-verified `@comfy.org` user; `flags.billingSdkTopupRailEnabled` resolves as the scenario expects.
- Stripe is in **test mode**. Confirm the TEST MODE banner on the provider page before completing the first payment. Card `4242 4242 4242 4242`, any future expiry, any CVC.
- Baseline credits total recorded from S0.

- **Open from the popover.** Choose `Add credits`. A dialog with heading `Add more credits` appears. The page object is `browser_tests/fixtures/components/TopUpCreditsDialog.ts`; reuse its locators (`preset10`…`preset100`, `payAmountInput` = testid `top-up-pay-amount`).
- **Buy on a saved card.** Choose `$50`, then `Pay $50.00`. The dialog settles and the credits total increases by exactly the credits the dialog quoted for that amount (its `Credits` field, e.g. `$50` → `10,550`), not by the dollar figure. The rate is workspace-specific, so read it from the dialog each run. On the SDK rail the `POST /api/billing/topup` shows resourceType `fetch` with an `Idempotency-Key`; on legacy, `xhr` with no such header.
- **Buy with no saved card.** On an account without one, the provider's payment page opens. Pay, return to the app, and the balance updates **without a manual reload**.
- **Decline.** Pay with a declining test card. A clear failure message appears and the credits total is **unchanged**. Re-read it after a reload, not just from the screen.
- **Reload mid-purchase.** Start a purchase and reload while it is still pending. The app picks the operation back up and reports its outcome rather than losing it. Watch `/api/billing/ops/…` and confirm exactly one recovery: the same operation must not be polled on `fetch` and `xhr` at once.
- **Abandon the payment tab.** Start a purchase and close the payment tab without paying. The dialog must not sit on a spinner indefinitely.
- **Two in a row.** Buy credits twice in quick succession. Each purchase is charged once. On a personal workspace, two distinct rows appear in `Activity` with the right amounts.
- **Immediately check the log (personal workspace).** Buy credits, then open `Activity` straight away. The top-up appears with the correct amount. On a team workspace, compare against S0 instead: team top-ups do not appear in `Activity` on either rail (see Gotchas).
- **Workspace binding.** Open the top-up dialog, switch workspace in a second tab, then complete the purchase in the first. The credits land in the workspace the purchase started in.
- **Proof.** For each case capture the request table, a screenshot of the dialog at the action, and a post-reload screenshot of the credits total. Save under `temp/verify-evidence/<scenario>/topup/`.

## Gotchas

- **Reload while parked at bank verification.** The operation pointer (`comfy:billing:operation…`, sessionStorage) survives the reload; the app re-offers with a toast `Verify your payment to add your credits` that has **no action button**. The path to resume is `Settings ▸ Plan & Credits ▸ Add credits`, which adopts the pending operation and shows `Verify your payment` → `Complete verification`. Closing the provider tab unpaid leaves that button available (no spinner); clicking it again reuses the same invoice. Verified live 2026-09-21.
- **The usage log will not show a team top-up, on either rail.** `GET /api/billing/events` with a team-scoped token returns `total: 0` twelve minutes after two settled top-ups, while the personal scope lists `credit_added` events. Legacy (S0) shows the same empty `Activity` for the team, so this is parity, not a rail defect.
- **Top-up has no legacy fallback.** The subscription rail falls back to the legacy client when the SDK route 404s and latches that for the tab; top-up does not. `useTopupOperation.ts:32-35` returns the SDK path unconditionally, and `topupOperationView.ts:115-119` throws away the `NOT_AVAILABLE` signal that `topup.ts:226` produces. If top-up starts failing for everyone the moment the flag goes on, the cause is a missing backend route and the correct response is to **turn the flag off, not retry**.
- The page object's `open()` calls `dialog.showTopUpCreditsDialog()` directly. That is a shortcut for setup, not a user path. A proof must reach the dialog by clicking.
- This dialog can open on top of another dialog, and each stacked dialog is its own `role="dialog"` root. Scope to the one containing the expected heading.
- The balance is read through the reads rail, not the top-up rail. In S2 the purchase runs on legacy while the balance that confirms it is read on the SDK. A mismatch there is a reads finding, not a top-up one.
- Presets are exact-match buttons (`$10` not `$100`); a loose name match hits both.
