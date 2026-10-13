# Cancellation retention offer

The current Cloud retention coupon runs for the server-supplied number of
calendar months starting at acceptance. It does not guarantee that many future
discounted renewals. For example, acceptance on February 28 can expire May 28,
so a May 31 renewal is already full price. Show regular and discounted monthly
rates, without a guaranteed total saving or a date calculated from `period_end`.
The offer applies to the current plan; changing plans may end the discount.

`RetentionAcceptance` exposes only `billing_op_id` and `status`.
`RetentionFlowSubscription.period_end` is the next renewal, and the flow's
`expires_at` is the cancellation session's expiry. Neither is the applied
coupon's expiry. Confirmation therefore describes the accepted duration without
a date. To show an authoritative expiry, Cloud must expose the applied
`RetentionReceipt.ends_at` as optional `retention_discount_ends_at` (Unix
seconds) on `BillingOpStatusResponse`, only for succeeded retention operations,
including replay of an already completed operation. The frontend can read it
using `billing_op_id` after either immediate success or polling. Regenerate the
ingest types and Zod schemas before consuming that field. Pending operations
must not supply a guessed date.

`RetentionOfferStep.test.ts` covers the offer and applied states, server-provided
percent and duration, singular/plural copy, and month-end acceptance. There are
no retention-flow Storybook stories; this component owns billing orchestration.
Translated messages are generated on release from `src/locales/en/main.json`,
as described in `CONTRIBUTING.md`.
