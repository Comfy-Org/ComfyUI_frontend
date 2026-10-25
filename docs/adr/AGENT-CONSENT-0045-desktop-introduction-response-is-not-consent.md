# ADR-AGENT-CONSENT-0045: Agent Introduction Response Is Not Consent

Date: 2026-10-20

## Status

Proposed

## Context

Agent can be introduced before sign-in on a local install. Remembering only that
a card was mounted suppresses future introductions without a user decision.
Conversely, requiring registered consent to stop startup offers repeatedly
interrupts users who explicitly skipped the introduction. Cloud and Desktop
used to follow different onboarding policies, chosen from the host at runtime.

## Decision

Revised 2026-10-24: Cloud and Desktop share one onboarding policy, and no
module checks the host for it.

Keep an introduction-response marker separate from the existing
account/workspace consent setting. Only Agree or Skip sets this marker; display
and dismissal do not. The marker controls automatic startup offers, never Agent
access. It lives in renderer storage, keyed by scope: `signed-out`, or the
account and workspace. Signed-out users can respond, the response survives
restarts, and a scope that has not answered still gets the card on the launches
below.

The panel opens automatically on the first two launches (the activation
visits), whether or not the user skipped consent or closed the panel. On those
launches, an unanswered scope also gets the consent card over the panel once
the screen is clear, including after signing in or switching to an unanswered
account or workspace during that launch. Later launches show no automatic
card, even when the panel was left open. Whether a launch is one of these is
read once, before it claims its visit.

After that, consent is asked when the user needs it: the Agent entry button
asks before it opens a closed panel, and Send asks before the first message.
Skip is remembered only by the response marker; no account-wide refusal is
stored. Neither the marker nor a Skip records audited server consent.

Agree while signed out continues through sign-in and confirmed server consent
registration within that request. Canceling sign-in discards the pending choice;
a later manual Agent request asks for consent again. Existing server readiness,
account/workspace ownership and consent persistence checks still gate Agent use.
An in-memory continuation flag prevents the automatic introduction from racing
this request during authentication. It is cleared on every ending and never
stored across launches. A scope change closes a still-undecided card.

## Alternatives and Consequences

Using accepted consent as the startup marker would make Skip ineffective across
restarts. Using a display marker would treat dismissal as a response. Neither
represents the user's explicit decision.

An account-wide refusal stored in user settings is not used: automatic cards
already end after two launches, and on a local install those settings belong to
the install, not the account.

Persisting a pending agreement across canceled sign-in would require recovery,
expiration and binding to a future authenticated account. Repeating the card on
the next manual request avoids that additional state. A single global marker
would need session tracking to tell an external sign-in from this request's own
sign-in; keying it by scope makes that tracking unnecessary. Clearing renderer
storage makes the introduction eligible again.
