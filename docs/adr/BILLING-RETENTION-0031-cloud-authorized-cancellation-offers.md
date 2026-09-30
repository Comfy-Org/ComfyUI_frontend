# ADR-BILLING-RETENTION-0031: Cloud-authorized Cancellation Offers

Date: 2026-09-30

## Status

Proposed

## Decision

Use Churnkey Direct during the trial, with the framework-independent runtime
from `@churnkey/react/core` 0.8.0 and a Vue dialog built from existing controls.
Cloud fetches the account-hosted SDK configuration once using its live Stripe
snapshot, restricts the flow to supported survey/feedback/confirmation steps
and the fixed 30% discount, and binds allowed decisions to an expiring session.
The browser initializes the core machine from that prepared configuration. It
does not fetch or allocate another account configuration.

Cloud owns authorization, eligibility, billing serialization, Stripe mutations,
and durable outcomes. The browser sends only a session ID to accept the offer,
then waits for the billing operation. Churnkey supplies configured copy, segments,
flow experiments, and session reporting. Cloud records blueprint/decision IDs,
observed offer cohorts, redemptions, and actual paid renewals. PostHog receives
measurement events without independently randomizing the experiment.

Cancel and discount handlers share a mutation guard. Closing waits for any
pending action. A lost response preserves an unconfirmed outcome and does not
open the cancellation fallback; discount recovery repeats the same session ID.
An explicit no-write rejection allows a new customer decision. Workspace changes
refuse actions. Unsupported offers are rejected on the server and by the client.

## Rollout

The original native app ID remains empty, so older releases stay disabled.
The new ingest and billing switches default off. Preparation failures before any
billing action use the existing cancellation confirmation. Configure a separate
Direct account with no billing provider, matching server credentials, the fixed
Stripe coupon, and compatible hosted steps before enabling.

Focused unit checks cover session authorization, mutation uncertainty, idempotent
recovery, and billing status handling. Live account configuration, invoice/test
clock checks, deployment ordering, and rendered end-to-end QA remain launch work.
