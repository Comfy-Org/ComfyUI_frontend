# ADR-BILLING-WEB-0038: Billing Web Hosts Checkout Only; Host Apps Own Plan Selection

Date: 2026-09-27

## Status

Accepted

## Context

`apps/billing-web` grew two things for choosing a plan: a plan grid on
`/v1/subscription` and `/v1/pricing` (`SubscriptionPanel` plan cards and
`PlanCard`), and a plan-change quote (`SubscriptionQuote`). Neither had a
design source. They were built in #17798 and #17937 as scaffolding while
the hosted app worked toward parity with the cloud app, which already has
its own pricing table, Monthly/Yearly switch, plan-change flow, and team
credit-stop selection.

The Milestone 2 live run on 2026-09-27 put the two side by side and found
the hosted copy had drifted from the in-app experience for the same
journey: yearly credits were labelled "monthly credits", and the
plan-change quote showed credits as a dollar amount. Each of these is a
small fix. The finding is that a second plan-selection UI with no design
source drifts by default, and every host that sends customers to
billing-web would carry that drift into the payment step.

The embedded checkout is the opposite case. ADR-PACKAGES-ACCOUNT-UI-0034
already puts payment presentation in `@comfyorg/account-ui` so that one
implementation serves every host.

## Decision

1. **billing-web hosts the embedded-checkout experience only**: the
   payment step, the 3DS challenge, and the result. It renders the same
   checkout UI as the cloud app's in-app embedded checkout, through the
   shared components in `packages/account-ui`, not a restyled fork.

2. **Plan selection belongs to each host app.** The pricing table,
   Monthly/Yearly, plan changes, and the team credit stop are chosen in
   the host, which then opens billing-web `/v1/checkout` with `plan`, and
   with `workspace` and `team_credit_stop_id` where they apply. The team
   credit stop behaves in billing-web exactly as in the in-app embedded
   checkout.

3. **`/v1/checkout` requires `plan`.** A plan-less `/v1/checkout`, and
   `/v1/pricing`, redirect to the host app through `return_to` rather
   than rendering a picker. The billing-web plan grid (`SubscriptionPanel`
   plan cards, `PlanCard`, `SubscriptionQuote`) is removed.

4. **The remaining routes stay.** `/v1/subscription` keeps cancel and
   resubscribe, without the plan grid; the host app keeps its own cancel
   and resubscribe too. `/v1/payment-methods`, `/v1/invoices`,
   `/v1/result`, and `/sign-in` are unchanged.

### Alternatives considered

- **Polish the billing-web plan grid to match the app.** Rejected: it
  keeps two implementations of one UX, and the drift found in the live
  run is what that arrangement produces between releases.
- **Ask design for a separate billing-web plan-selection spec.** Rejected:
  it gives one purchase journey two designed UXs, which is the divergence
  this decision removes, now with a design source behind each side.

## Consequences

### Positive

- A customer sees one plan-selection UI and one checkout UI whichever host
  they start from.
- billing-web no longer needs plan catalogue, interval, or quote logic of
  its own, so it has no copy of those to keep in step with the app.

### Negative

- A host without its own plan selection cannot send customers to
  billing-web to pick a plan; it must build that UI or deep-link into a
  host that has one.
- Rendering identically in both hosts means the shared components use
  design-system token classes. That relaxes ADR-PACKAGES-ACCOUNT-UI-0034
  rule 4 ("the package stays unstyled"), amended there.
- Cancel and resubscribe exist in both billing-web and the host app, so
  those two actions still have two surfaces to keep aligned.

## Notes

- [ADR-BILLING-WEB-0031](BILLING-WEB-0031-static-spa-boundary.md): its line
  that the flag redirects Plans & pricing to billing-web is superseded by
  rule 2 and carries an amendment note.
- [ADR-PACKAGES-ACCOUNT-UI-0034](PACKAGES-ACCOUNT-UI-0034-payment-ui-belongs-to-the-shared-account-ui-package.md):
  rule 4 is amended to allow design-system token classes.
- [ADR-AUTH-BILLING-0032](AUTH-BILLING-0032-billing-stays-outside-the-account-package-in-v1.md):
  rule 4 (no site-local billing surfaces) is the same principle applied to
  `apps/website`; billing-web's checkout follows it through the shared
  package.
