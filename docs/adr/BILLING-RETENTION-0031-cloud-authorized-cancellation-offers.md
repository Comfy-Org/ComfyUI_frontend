# ADR-BILLING-RETENTION-0031: Cloud-authorized Cancellation Offers

Date: 2026-09-11

## Status

Proposed

## Context

The cancellation embed previously ran a survey with all save offers rejected.
The fixed experiment offers eligible monthly Stripe workspaces 30% off three
renewals. Eligibility, repeat redemption, billing concurrency, and durable
assignment must survive browser retries and owner changes.

## Decision

Cloud prepares an owner-bound, expiring cancellation session and returns the
persisted PostHog workspace assignment plus the single allowed offer. The client
does not evaluate the experiment flag. A separate Churnkey Direct application
renders the survey using the exact subscription and workspace identity returned
by Cloud. Control and ineligible sessions omit the discount handler; Direct
hides offers without a matching handler. Treatment registers only the fixed
discount handler, validates its terms, and submits only the session identifier
to Cloud. Cloud rechecks eligibility and applies the subscription discount in a
Temporal workflow. The UI waits for the billing operation to succeed before
reporting that the discount was saved.

Cancel and discount callbacks share a session mutation guard. Repeated callbacks
share one promise; cancellation cannot overlap a pending discount. Closing or a
vendor error waits for that promise before clearing the embed. Failed offers
never submit cancellation; continuing cancellation requires the user to choose
it explicitly. A module-level launcher prevents concurrent global SDK sessions.
Workspace changes invalidate callbacks and suppress fallback for the old workspace.

The first vendor step records experiment participation for both variants. An
actual discount step records a separate treatment exposure. Cloud persists these
events with workspace identity and deduplicates retries. Cancellation confirmation
telemetry follows successful cancellation rather than the initial click.

## Consequences

The rollout is disabled until Cloud, its worker, and the separate Direct
application are configured. An old backend or disabled rollout retains the
existing survey; other failures use the existing cancellation confirmation.
When Cloud enables Direct, it stops issuing the native Stripe application's HMAC.
A pending or uncertain provider result is shown as unconfirmed and cannot be
reported as a saved discount. The existing billing mutation gate may require
support reconciliation before another billing change is allowed.

Moving between eligible monthly plans preserves the original discount expiry.
Annual plans, another promotion, a catalog discount, and a cycle reset end this
discount; the normal plan-change preview determines the new amount. No pause,
resume, adaptive offers, or additional cancellation layout is introduced.

## Validation

Unit tests exercise both variants, exposure deduplication, workspace switches,
duplicate acceptance, close/error races, reconciliation, and explicit cancellation
after rejection. Cloud tests cover allocation, ownership, eligibility, provider
idempotency, and durable receipts. A configured Churnkey preview and Stripe test
clocks remain launch requirements; a mocked SDK does not validate vendor setup.
