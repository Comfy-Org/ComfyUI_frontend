# ADR-API-SERVER-FACTS-0042: Server Facts Are Rendered, Not Derived

Date: 2026-10-09

## Status

Proposed

## Context

The frontend keeps recombining facts the backend owns into decisions of its
own. The latest case shipped two billing P0s (BE-19903 Invite member,
BE-19904 Manage seats) through three PRs that agents wrote and agents
approved:

- #15675 gated member management on `isCloud ? can_change_seats : role`.
  `can_change_seats` answers "may this workspace change its seat quantity",
  so Enterprise owners lost member management.
- #18662 OR'd `isPlanEnded && canManageSubscription` onto `can_invite_members`.
- #19455 added tier and plan-status checks so that gate survived the backend
  collapsing `max_seats` to 1.

This is not specific to billing. Since April, about 20 fixes moved a
decision back to the server after the client had derived it, including:

- workspace creation (`can_create_workspace`)
- agent gating (server `/features`)
- the free-run offer (`free_tier_offer`)
- asset counts
- release notes keyed by the wrong version
- queue caps

Each derivation is a second copy of backend policy. It drifts silently,
because a wrongly hidden or disabled control emits nothing.

A rule written as prose did not stop it. A reviewer-side "never approve a
frontend-derived server fact" rule was in place before #18662 and #19455,
and both were approved. This guidance also pointed the other way:
`docs/guidance/state-and-effects.md` said "derive everything derivable", and
its first example was a `can*` flag.

## Decision

A **server fact** is anything the backend knows about an account, workspace,
subscription or resource that would stay true with no UI:

- permissions and capabilities
- role, tier, plan status and seats
- readiness and versions
- server timestamps and error codes

1. **The server fact alone decides entitlement.** A gate renders one server
   fact as received. It does not combine that fact with another server fact
   or a value derived from one (role, tier, plan state, seats, `isCloud`)
   through `&&`, `||`, `??`, a ternary, arithmetic, a comparison or a helper.
   It also does not choose which fact answers the question. Local, transient
   UI state (loading, an in-flight request, form validity) may delay or
   disable the control, as in `canTopUp && !isLoading`. It never grants
   entitlement or stands in for a server field.
2. **`isCloud` decides which build ships, not what a user may do.** Off
   Cloud, a local provider answers the same fact.
3. **A failed read uses the default its contract names.** Never fall back to
   a role or a tier.
4. **A fact the API does not emit yet is a backend ticket.** Until the ticket
   lands, wrap the interim expression in `pendingServerFact('<ticket>', expr)`.
   Never substitute another field. `can_change_seats` is not member
   management.
5. **Choosing which server field answers a UI question needs review from
   the backend team that owns the field.**

Presentation stays on the client: formatting, translation, sorting, layout,
and local UI state such as loading, open panels and form validation.

The rule is enforced by checks that fail, not by prose:

- oxlint rules on changed lines
- a checked-in agent write hook
- an approve gate
- orthogonality tests on every gate a PR touches
- the `pendingServerFact` expiry check

The TDD "Server-fact guardrails" tracks these checks (FE-3349).

### Alternatives considered

- **More Markdown in reviewer skills.** Rejected: it was already in place
  and failed twice.
- **An LLM reviewer prompt for this rule.** Rejected as a gate: that is what
  approved the three PRs. It is not calibrated, and it shares the author's
  framing.
- **Opaque `ServerFact<T>` types now.** Deferred: it is the strongest
  guarantee, but about 15 billing surfaces and other domains have to migrate
  first. Lint holds the line in the meantime.
- **Server-driven UI.** Rejected for now: out of scope for the capabilities
  API.

## Consequences

### Positive

- One copy of each policy, in the backend, shared by every client (app,
  billing-web, website, platform).
- A missing fact becomes a visible backend ticket instead of a silent client
  proxy.
- Reviewers and agents get a mechanical test: is this gate one server fact,
  as received?

### Negative

- Some UI waits on backend fields that the client could approximate today.
  `pendingServerFact` is the escape hatch, and it expires with its ticket.
- Existing derivations need burning down domain by domain. Until then, new
  code is held to the rule on changed lines only.

## Notes

- Capabilities TDD: "an API should emit facts about its own domain, and
  clients should render those facts rather than recombine them into a
  decision."
- Related: ADR-AUTH-SESSION-0037 (the server owns the AND for one flag).
