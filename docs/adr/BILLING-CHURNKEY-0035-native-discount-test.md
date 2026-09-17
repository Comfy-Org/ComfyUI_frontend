# ADR-BILLING-CHURNKEY-0035: Prove Native Churnkey Discounts in Test Mode

Date: 2026-09-17

## Status

Proposed

## Context

The cancellation embed overrides discount acceptance with a rejection. Before
building another billing mutation endpoint, we need to establish that Churnkey's
Stripe integration can apply a subscription discount while Comfy retains the
plan and full renewal credit allowance. The intended first experiment uses
Churnkey assignment and offers 30% off for three calendar months to current
monthly Personal plans on the consolidated Stripe rail.

## Decision

Use a backend-selected non-production test audience. An optional auth response
field identifies the exact subscription. Only test mode with that field omits
the discount handler override, allowing Churnkey's native action. A successful
`onDiscount` notification records the outcome; closing the session refreshes
billing for the workspace that launched it. A subsequent display or refresh
error must not reopen cancellation after a confirmed discount. Other offers
remain rejected, and cancellation continues through Comfy's API.

Use the generated auth schema so the optional field survives runtime parsing.
Do not introduce a PostHog experiment assignment or a second discount writer.
Do not globally remove the rejection handler: that would enable existing offers
before their billing behavior and audience have been established.

## Consequences

This supports a real Stripe Test billing proof while preserving the default
behavior. It does not launch or configure the Churnkey experiment, create its
coupon, or enforce the production retention policy. The auth HMAC still signs
only the customer identity; the browser guard is not billing authorization.

Before production, establish server/vendor enforcement for repeat claims,
existing discounts, plan changes and stale or concurrent sessions, and prove
discounted renewals preserve credits. The required repeat limit is four calendar
months between successful account claims. Upgrades and downgrades end the offer
when they take effect. An already open session can outlive the admission read,
so passing the initial check is insufficient production enforcement.

## References

- [Churnkey callback and subscription targeting documentation](https://docs.churnkey.co/cancel-flows/further-configuration/)
- Backend: `services/ingest/server/implementation/churnkey.go`
