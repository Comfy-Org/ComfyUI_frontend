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
module checks the host for it. Revised 2026-10-27: a signed-out Agree is kept
across a sign-in that reloads or leaves the page.

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
stored. The startup response-marker check ends an answered introduction without
a telemetry event, since reporting it would emit once per page load for every
user who has answered. An accepted consent load still emits
`consent_already_accepted`.
Neither the marker nor a Skip records audited server consent.

Agree while signed out continues through sign-in. When sign-in finishes in the
page, consent is registered within that request. Desktop's Google and GitHub
sign-in reloads the page, and the local web sign-in redirects away and back, so
just before the sign-in dialog opens the pending Agree and the held message
text are written to a session record (`sessionStorage`, 10-minute expiry):

- The record is read only when a page starts. A page that starts signed out
  drops it. A signed-in page waits for the account to resolve and for any
  workspace switch to end, then takes the record once and registers consent for
  the first account that page resolved to. Only after the save does it put the
  text back into an empty composer. Nothing is sent automatically.
- Closing the sign-in dialog does not clear the record: the page cannot tell a
  cancel from Desktop's browser sign-in carrying on. Any later answer on a
  consent card in the page clears it, and a new signed-out Agree replaces it.

Existing server readiness, account/workspace ownership and consent persistence
checks still gate Agent use. An in-memory continuation flag keeps the
automatic introduction from racing this request during authentication or the
post-reload save, and a Send made during that save waits for it. The flag is
never stored across launches. A scope change closes a still-undecided card.

## Alternatives and Consequences

Using accepted consent as the startup marker would make Skip ineffective across
restarts. Using a display marker would treat dismissal as a response. Neither
represents the user's explicit decision.

An account-wide refusal stored in user settings is not used: automatic cards
already end after two launches, and on a local install those settings belong to
the install, not the account.

The pending-Agree record is read once rather than kept until the save
succeeds. If that save fails, the card asks again on the next Send and the text
is restored in that page. If a second reload interrupts the save, the text is
lost as well. Closing the sign-in dialog keeps the Agree even if browser sign-in
never started or was cancelled, so a later sign-in and reload in the same tab
within 10 minutes may use it, unless a newer card answer cleared it. Only the
message text is kept, trimmed of leading and trailing whitespace; references
and attachments are not. Tracking the browser sign-in instead was rejected: the
page has no handle on Desktop's Google and GitHub flow. A single global marker
would need session tracking to tell an external sign-in from this request's own
sign-in; keying it by scope makes that tracking unnecessary. Clearing renderer
storage makes the introduction eligible again.
