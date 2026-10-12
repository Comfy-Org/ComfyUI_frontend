# Subscription lifecycle

A user subscribes to a plan, changes plan mid-cycle, cancels, resumes before the period ends, and manages billing on the provider's portal. Unlike top-up, this rail falls back to the legacy client when the SDK route is unavailable. A green result here can mean either rail actually ran, so the transport has to be checked rather than inferred.

## Sub-features

- `sub-subscribe` subscribe to a plan and see it reflected after a reload.
- `sub-change` change plan mid-cycle; the confirmation amount matches the charge.
- `sub-cancel` cancel, with the scheduled end date shown.
- `sub-resume` resume before the period ends, with no second charge.
- `sub-portal` `Manage billing` opens the provider portal and returning refreshes state.
- `sub-team-downgrade` downgrade a team workspace to personal.
- `sub-pending-reload` a pending subscription operation is recovered exactly once.

## How to get to it (user POV)

- `Settings` → `Plan & Credits` → the plan picker / `Subscribe` CTA.
- `Settings` → `Plan & Credits` → `Billing & invoices` (the provider portal).
- The cancellation entry on the current-plan card; confirm dialog heading `Cancel subscription`, buttons `Keep subscription` / `Cancel subscription`.
- After cancelling, the current-plan card shows `Resume subscription`.
- The `?pricing=` deep link.

## Driving it with the browser

Preconditions:

- Doctor passes; signed in as an email-verified `@comfy.org` user; `flags.billingSdkSubscriptionRailEnabled` resolves as the scenario expects.
- Stripe in test mode, card `4242 4242 4242 4242`. Confirm the TEST MODE banner before the first payment.
- Both a personal and a team workspace available. S0 baseline plan name and renewal date recorded.

- **Subscribe.** Choose a plan and complete checkout. The success screen names the plan chosen, and `Settings` agrees after a reload. Confirm the subscribe request ran on `fetch` with an `Idempotency-Key`.
- **Change plan mid-cycle.** Switch to a different plan. The amount shown on the confirmation is what is actually charged. Verify against the provider receipt or the usage log, not just the dialog.
- **Cancel.** Cancel and let the confirmation dialog complete. The scheduled end date shown matches `Settings` after a reload.
- **Resume.** Before the period ends, choose `Resume subscription`. The plan returns to active and no second charge appears.
- **Portal.** Choose `Billing & invoices`. The portal opens in a new tab; returning to the app refreshes plan state.
- **Team downgrade.** Downgrade a team workspace to personal. Member removal and the resulting plan are both correct.
- **Pending reload.** With a subscription operation still pending, reload. Exactly one recovery happens. Watch Network and confirm the same `/api/billing/ops/…` is **not** being polled on `fetch` and `xhr` simultaneously.
- **Proof.** Per case: request table, dialog screenshot at the action, post-reload `Plan & Credits` screenshot. Save under `temp/verify-evidence/<scenario>/subscription/`.

## Gotchas

- **Cancel runs through Churnkey first, then the rail.** When `/api/features` carries a `churnkey_app_id`, `Plan & Credits ▸ ⋯ ▸ Cancel plan` opens Churnkey's retention survey (`/api/billing/churnkey/auth` on `xhr`, then `assets.churnkey.co` and `api.churnkey.co`). Churnkey's `handleCancel` calls `billing.cancelSubscription()` (`launchCancellationFlow.ts:62-76`), which is the SDK rail when the flag is on. If Churnkey fails to prepare, the in-app `Cancel subscription` dialog opens instead. Back out of the survey with `Go Back` to leave the subscription intact.
- **The credit slider is a native `input[type=range]`.** Clicking a tick label does nothing and keyboard arrows do not apply after a programmatic `focus()`. Drag the thumb (`left_click_drag`) to change tiers.
- **Credit stops come from the top level of the plans payload**, not from each plan: `{current_plan_slug, plans, team_credit_stops:{default_stop_index, stops}}`. Stop ids are `team_<usd>` (`team_700`, `team_1400`, …). The hardcoded fallback in `constants/teamPlanCreditStops.ts` carries **no ids**, so if the API stops serving stops every subscribe/preview 400s with `team_credit_stop_id is required`.
- **A workspace with a scheduled plan change cannot change plan again.** The backend answers `400 SUBSCRIPTION_CHANGE_IN_PROGRESS`. Use a team workspace with no pending change to test the charged-amount path.
- **The fallback hides the rail.** A 404 on the SDK route maps to `unavailable` → `DECLINED`, and the caller silently runs the legacy path; `billingSdkStore` then latches it for the whole tab. So a subscription that succeeds proves nothing about which transport served it. Always check resourceType. Once the latch trips, every later subscription call in that tab is legacy until the tab is closed.
- **Behaviour difference worth reporting, not a pass/fail.** On the SDK rail, a subscription left parked mid-payment causes the app to open the payment page **by itself at startup**; the legacy rail leaves it behind a button. Observe whether a payment tab opens unprompted and whether the browser blocked it. A product decision is pending. Report what you see.
- The resume control reads exactly `Resume subscription`. Anything else means the subscription is not in the resumable window.
- `Cancel subscription` is both the entry and the confirm button label; scope the confirm to the dialog root.
- Team and personal workspaces take different paths. A result from one does not carry to the other; run both.
- A team change from one credit-stop to another has no proration path implemented. Do not report it as a rail defect.
