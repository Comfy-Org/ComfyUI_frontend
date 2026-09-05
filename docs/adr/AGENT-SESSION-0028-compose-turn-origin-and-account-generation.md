# ADR-AGENT-SESSION-0028: Compose Turn Origin and Account Generation

Date: 2026-09-05

## Status

Proposed

## Context

An agent send crosses two asynchronous boundaries: workflow preparation and the
turn request. Two independent identities can change while either operation is in
flight:

- the active workflow tab can change, which must not reattribute the request's
  workflow context, open tabs, or draft snapshot;
- the authenticated account can change, which must prevent the old account's
  request from being sent or applied to the new account's session.

PR #16840 introduced a `TurnOrigin` captured before workflow preparation and
resolved after preparation. PR #16768 independently introduced an account
generation captured before the same await. Merging either side mechanically
would remove one guard or mix origin-pinned draft data with active-tab workflow
data.

```text
send starts
    |
    +-- capture TurnOrigin ---------> resolve workflow data from that tab
    |
    +-- capture account generation -> reject if the account changes
    |
    `-- await prepare() ------------> post only when both checks hold
```

## Decision

Compose the two mechanisms in `sendMessage`:

1. Capture both the account generation and `TurnOrigin` before `prepare()`.
2. After `prepare()`, reject the send if its account generation is stale.
3. Resolve workflow context, open tabs, and draft using the captured
   `TurnOrigin`.
4. Retain the account-generation checks after the turn request so a later
   account change also prevents stale response state from being applied.

The account generation owns authentication changes. `TurnOrigin` owns tab
attribution. Neither substitutes for the other.

## Consequences

### Positive

- A tab switch during preparation cannot attach the new tab's graph to the old
  prompt.
- An account switch during preparation prevents the old prompt from being
  posted.
- All request workflow fields use one origin, avoiding mixed-tab payloads.

### Negative

- `sendMessage` must preserve two explicit freshness checks across its awaits.
- A future session-identity redesign must either retain both dimensions or
  demonstrate equivalent coverage before removing either mechanism.

## Alternatives Considered

### Keep only `TurnOrigin`

Rejected. It preserves tab attribution but allows a prompt started under one
account to post after the authenticated identity changes.

### Keep only account generation

Rejected. It protects account state but resolves workflow context and open tabs
from the active tab after preparation, while the draft remains origin-pinned.

### Adopt PR #16393's composite session checks in this merge

Deferred. That branch combines session generation, load generation, and thread
destination checks, but does not pin workflow data to the originating tab. Its
broader storage and session model requires separate reconciliation; it is not a
safe substitute for either mechanism in this conflict.

## Glossary

- **Account generation**: A counter incremented when the authenticated identity
  changes; an operation is stale when its captured value no longer matches.
- **Turn origin**: The workflow tab path captured when a send begins.
- **Workflow preparation**: The asynchronous step that makes workflow IDs and
  related context available before posting a turn.
- **Mixed-tab payload**: A request whose workflow fields came from different
  tabs because the active tab changed during an await.

## References

- PR #16768, `useAgentSession.ts`
- PR #16840, `useAgentSession.ts`
- PR #16393, alternative session-identity carrier
