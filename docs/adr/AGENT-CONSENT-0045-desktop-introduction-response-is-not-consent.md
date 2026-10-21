# ADR-AGENT-CONSENT-0045: Desktop Introduction Response Is Not Consent

Date: 2026-10-20

## Status

Proposed

## Context

Desktop can introduce Agent before sign-in. Remembering only that a card was
mounted suppresses future introductions without a user decision. Conversely,
requiring registered consent to stop startup offers repeatedly interrupts users
who explicitly skipped the introduction.

## Decision

Keep a local Desktop introduction-response marker separate from the existing
account/workspace consent setting. Only Agree or Skip sets this marker; display
and dismissal do not. The marker controls automatic startup offers, never Agent
access. It belongs to the current Desktop renderer storage, without account
identity, so signed-out users can respond and the response survives restarts.

For eligible, ready Desktop installations, unfinished consent opens the locked
panel on each startup after authentication and onboarding settle, independently
of Cloud's activation visit limit. The response marker suppresses only the
startup introduction. A subsequent account/workspace transition queues a card
for that new server scope after the screen clears. The Local entry button only
toggles the panel; Send owns the consent request.

Cloud's account-wide explicit-refusal preference remains separate. Desktop Skip
does not write that preference, and an existing Cloud refusal does not suppress
the Desktop introduction or recurring locked panel. Neither preference records
audited server consent.

Desktop 2 hosts the localhost frontend distribution, so this policy also checks
its local host bridge. The legacy desktop build remains supported; Cloud builds
and remote Desktop views do not use this introduction policy.

Agree while signed out continues through sign-in and confirmed server consent
registration within that request. Canceling sign-in discards the pending choice;
a later manual Agent request asks for consent again. Existing server readiness,
account/workspace ownership and consent persistence checks still gate Agent use.
An in-memory continuation flag prevents the automatic introduction from racing
this request during authentication. It is cleared on every ending and never
stored across launches. A scope change closes a still-undecided Desktop card.

## Alternatives and Consequences

Using accepted consent as the startup marker would make Skip ineffective across
restarts. Using the old display marker would treat dismissal as a response.
Neither represents the user's explicit decision.

Persisting a pending agreement across canceled sign-in would require recovery,
expiration and binding to a future authenticated account. Repeating the card on
the next manual request avoids that additional state. A shared Desktop profile
shares the introduction marker, while each account/workspace retains its own
consent requirement. Clearing renderer storage makes the introduction eligible
again. Cloud introduction behavior remains unchanged.
