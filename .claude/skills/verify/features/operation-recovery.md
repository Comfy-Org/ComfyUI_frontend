# Operation recovery and bank verification

Every billing write is an operation the app must follow until it settles, across reloads and across a detour to the bank's verification screen. With embedded checkout off, which is the configuration every customer is in, the bank screen belongs to the provider. What the app owns is everything around it: offering the verification, knowing when it finished, and never asking a customer to repeat a step they already completed.

## Sub-features

- `recover-pointer` a pending operation is picked up after a reload and reported.
- `recover-once` recovery happens exactly once, on one transport.
- `recover-stale` a pointer older than its max age is not resurrected.
- `verify-complete` 3DS completed on the provider page settles the operation.
- `verify-abandon` 3DS abandoned offers a retry instead of a spinner.
- `verify-retry` the offered retry completes normally.
- `verify-no-repeat` a completed verification is not re-offered.
- `verify-fail` a failed verification shows a declined state with a reason.
- `verify-reload` reloading before settlement still reports the final outcome.

## How to get to it (user POV)

- Start any purchase or subscription with a card requiring bank verification, then reload, or let the provider page sit unfinished.
- Reopen the app with an operation left pending from a previous session.

## Driving it with the browser

Preconditions:

- Doctor passes; signed in as an email-verified `@comfy.org` user; the relevant rail resolves on.
- Stripe in test mode. A card that triggers 3DS, in addition to `4242 4242 4242 4242`.
- `embedded_checked_enabled` stays **off**. This file is the P0 shape. Do not override it here.

- **Complete verification.** Pay with a 3DS card, complete the bank step on the provider page, return to the app. The purchase or subscription settles and the balance or plan updates **without a manual reload**.
- **Abandon verification.** Pay with a 3DS card and leave the provider page without completing. Return to the app. A way to retry must be offered, not a spinner and not a silent failure.
- **Take the retry.** Complete the offered retry. It settles normally.
- **No repeat.** Immediately after completing verification, watch the app for a few seconds. It must **not** re-offer the verification step just finished.
- **Fail deliberately.** Fail the bank verification. The app shows a declined state with a reason, and the balance or plan is unchanged. Confirm by reloading and re-reading.
- **Reload before settlement.** Complete verification, then reload before the app has settled the operation. It still reports the final outcome.
- **Cross-session pickup.** Leave an operation pending, close the tab, reopen the app. The operation is recovered and reported.
- **Exactly once.** Throughout, watch `/api/billing/ops/…`. The same operation must never be polled on `fetch` and `xhr` at the same time. That is two recoveries racing, and it is the failure mode this feature exists to catch.
- **Proof.** Capture the request table across the whole reload boundary (not just after), the offered-retry screenshot, and the post-settlement state after a reload. Save under `temp/verify-evidence/<scenario>/recovery/`.

## Gotchas

- The operation pointer lives in `sessionStorage` under a `comfy:billing:operation` prefix with a 24h max age. It dies with the tab. "Reopen the app" means a new tab in the same browser, not a restarted browser, unless you are deliberately testing the stale path.
- The rail that owns a recovery is keyed on the pending operation's type, not on which flag you flipped last. A pending top-up recovers on the top-up rail even in S2.
- With embedded off, `selectBillingPresentation` returns `hosted` unconditionally, `retryPaymentAuthentication` returns false without doing anything, and switching to embedded is refused as `embedded_unavailable`. None of the in-page challenge code runs. If a case here seems to have no visible behaviour, that is why. It belongs to P2, not P0.
- Do not confuse "the provider page rejected the card" with "the app failed to follow the operation". Read the request table before filing either.
- A verification re-offered after completion is a customer-visible defect even if the money is correct; report it as such.
