# ADR-AGENT-SESSION-0028: Compose Turn Origin and Account Generation

Date: 2026-09-05

## Status

Proposed

> Authored by an agent from the merge analysis of PR #16768, #16840, #16949, and
> #17324. This ADR was first drafted on 2026-09-05 inside a conflict-resolution
> merge that never reached `main`; it is re-expressed here so the decision has a
> home on `main` independent of which carrier PR lands first.

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

## Amendment: Persisted Session Scope Has Two Dimensions

The original decision names one identity dimension for the in-flight guard
(account). The persisted thread-id storage that survives a reload has a second
dimension that the two open carriers model differently:

| Carrier   | Storage owner key                                                         | Dimensions            |
| --------- | ------------------------------------------------------------------------- | --------------------- |
| PR #16768 | `Comfy.Agent.ThreadOwnerId` compared against the account id               | account               |
| PR #17324 | `${encodeURIComponent(userId)}/${encodeURIComponent(workspaceId)}` suffix | account and workspace |

A user who switches team workspace without switching account keeps the same
account id, so an account-only owner match resumes the previous workspace's
thread inside the new workspace. The composite scope prevents that; the
account-only match does not.

```text
                       account changes      workspace changes
account-only owner     reset thread         resumes wrong thread   <- gap
composite scope        reset thread         reset thread
```

Decision:

1. The canonical persisted scope is the composite key
   `${encodeURIComponent(userId)}/${encodeURIComponent(workspaceId)}` from
   PR #17324. The `/` separator is chosen because `encodeURIComponent` never
   emits it, so the two components cannot collide.
2. PR #16768's `agentSessionMemory` service and `agentIdentityStateTracker`
   are retained, fed by the composite scope instead of the account-only owner
   key. The separate `Comfy.Agent.ThreadOwnerId` key is dropped; the scope
   suffix already encodes ownership.
3. PR #16768's cross-store purge on identity change and the `identityGeneration`
   / `isCurrentIdentity()` guards remain the mechanism that aborts in-flight
   turns; PR #17324's `watch(storageScope, reconcileStorageScope)` is the
   trigger that detects a scope change.
4. One telemetry slug reports storage access failures:
   `agent_session_storage_access_failed` (PR #17324). PR #16768's
   `agent_session_memory_storage_failure` and the earlier
   `agent_thread_id_clear_failed` / `agent_thread_id_persist_failed` pair from
   the closed PR #16393 are not adopted.
5. Whichever carrier lands second rebases onto the other and applies the rules
   above. If PR #16768 lands first, the workspace dimension is a tracked gap
   until PR #17324 or an equivalent follow-up lands.

## Consequences

### Positive

- A tab switch during preparation cannot attach the new tab's graph to the old
  prompt.
- An account switch during preparation prevents the old prompt from being
  posted.
- All request workflow fields use one origin, avoiding mixed-tab payloads.
- A workspace switch without an account switch does not resume the previous
  workspace's thread.
- Dashboards filter on one storage-failure slug regardless of which carrier
  wrote the code.

### Negative

- `sendMessage` must preserve two explicit freshness checks across its awaits.
- A future session-identity redesign must either retain both dimensions or
  demonstrate equivalent coverage before removing either mechanism.
- Two carriers currently conflict in `useAgentSession.ts`; the second to land
  pays the rebase cost.
- Existing `Comfy.Agent.ThreadId` and `Comfy.Agent.ThreadOwnerId` entries are
  orphaned once the composite key ships; PR #17324 removes the legacy key, but
  users with the owner key from a pre-release build keep a dead entry until it
  is cleaned up.

## Alternatives Considered

### Keep only `TurnOrigin`

Rejected. It preserves tab attribution but allows a prompt started under one
account to post after the authenticated identity changes.

### Keep only account generation

Rejected. It protects account state but resolves workflow context and open tabs
from the active tab after preparation, while the draft remains origin-pinned.

### Adopt PR #16393's composite session checks in this merge

Superseded. PR #16393 was closed on 2026-09-10 and re-expressed as PR #17324.
Its composite storage scope is adopted by the amendment above; its broader
session, load, and destination generation checks are not, because PR #16768's
`identityGeneration` covers the same abort path with one counter.

### Account-only owner key with a separate workspace key

Rejected. Two keys must be read and compared on every scope change and can
disagree if one write fails; one composite suffix is atomic per entry.

### Dot separator in the composite key

Rejected. `encodeURIComponent` leaves `.` unescaped, so a user id or workspace
id containing a dot would be ambiguous. `/` is always escaped to `%2F` inside
the components.

## Glossary

- **Account generation**: A counter incremented when the authenticated identity
  changes; an operation is stale when its captured value no longer matches.
- **Turn origin**: The workflow tab path captured when a send begins.
- **Workflow preparation**: The asynchronous step that makes workflow IDs and
  related context available before posting a turn.
- **Mixed-tab payload**: A request whose workflow fields came from different
  tabs because the active tab changed during an await.
- **Storage scope**: The suffix appended to the persisted thread-id key so
  entries written under one identity are invisible under another.
- **Carrier**: An open PR that carries part of the agent-session identity model
  to `main`.
- **Identity generation**: PR #16768's counter, incremented by
  `agentIdentityStateTracker` whenever the account changes; `isCurrentIdentity()`
  compares a captured value against it.

## References

- PR #16768, `useAgentSession.ts`, `agentSessionMemory.ts`,
  `agentIdentityStateTracker.ts`
- PR #16840, `useAgentSession.ts`
- PR #16949, related agent-session carrier
- PR #17324, `useAgentSession.ts` composite storage scope (supersedes the
  closed PR #16393)
