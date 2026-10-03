# ADR-WORKFLOW-PERSISTENCE-0031: Identity-Scoped Draft Storage

Date: 2026-09-09

## Status

Proposed

## Context

Cloud workflow drafts and agent session state were keyed by workspace ID. That
is not an owner: two authenticated users can use the same team workspace, and
every personal workspace uses the name `personal`. Their browser state therefore
collided, so the last writer could overwrite another user's saved draft or
restore another user's thread and workflow bindings.

The user and workspace also resolve independently. During login, logout, an
account switch, or a workspace switch, one can be current while the other is
stale. Defaulting an unresolved Cloud workspace to `personal` turns that mixed
state into a plausible but incorrect key.

The storage model needs the same property as a tenant-owned database row: one
owner mints the key, writes are refused while that owner is unknown or changing,
and an operation scheduled by one owner cannot commit after another owner takes
over.

## Decision

### One function owns storage scope

`resolveStorageScope(userId, workspaceId)` is the only production constructor
for `StorageScope`, an opaque branded string. A Cloud scope is
`${userId}:${workspaceId}` when both components are resolved and `null`
otherwise. Non-Cloud builds resolve to `personal`, preserving their existing
keys. The root-mounted `useStorageScopeLifecycle()` composable owns auth and
workspace lifecycle updates for all persistence consumers; workflow and agent
features only read the resulting state, so neither depends on GraphCanvas
mounting first. The workspace store's resolved `activeWorkspaceId` is the
authoritative workspace component; persistence does not independently derive
scope from the `Comfy.Workspace.Current` session cache.

Draft indexes and payloads, persistent tab pointers, agent thread IDs, workflow
tab bindings, title overrides, and deletion markers all use `StorageScope`.
Production code cannot pass a bare workspace ID to their key constructors. An
explicit `unsafeStorageScope()` escape hatch exists only for tests, making every
unverified fixture scope greppable.

### Unknown or changing ownership is non-persistent

`useStorageScopeLifecycle()` owns resolved-identity transitions at the
application root. `storageIO` holds that authoritative identity and exposes a
tri-state write gate:

- `open`: the scope is resolved and storage is available;
- `deferred`: identity or workspace ownership is unresolved or transitioning;
- `closed`: browser storage is unavailable.

Workflow persistence keeps the live graph authoritative while the gate is
deferred. Work emitted before the first identity resolves is retried for that
first resolved owner. Debounced work emitted by a known user records that owner
and is cancelled when identity changes, so user A's work is never retried as
user B.

Agent stores use scoped reactive storage. While scope is unresolved or a
workspace transition is active, their refs remain usable in memory but do not
read or write `localStorage`. When ownership resolves, they bind to that exact
scope and load its persisted value. Workspace-transition completion invalidates
the old binding before the destination key is selected.

### Identity changes invalidate workspace evidence at the source

The root `useStorageScopeLifecycle()` observes the resolved Firebase or API-key
identity. When that owner changes, it resets the team workspace store before
publishing the new storage identity. Persistence therefore cannot conclude a
new user's fence using the previous user's `ready` workspace state.

### Logout removes one captured scope

The logout command captures the resolved scope before authentication is
cleared. After logout succeeds, it removes only that scope's workflow and agent
keys and clears tab-local restore pointers. It does not enumerate and delete
other users' or workspaces' scoped keys. If no owner was resolved, cleanup skips
rather than guessing.

### Legacy workspace-to-identity migration is separate

This decision does not claim ownership of legacy workspace-keyed Cloud data.
The existing V1-to-V2 format migration remains for the unchanged non-Cloud
`personal` scope. Cloud startup does not move a workspace key into whichever
identity resolves first.

A cross-tab migration protocol, a read-only legacy fallback, or an explicit
decision not to migrate is follow-up work. It requires its own decision because
`localStorage` provides no compare-and-swap primitive and a read-then-write
claim cannot establish exclusive ownership across tabs.

## Consequences

### Positive

- Two users in one workspace no longer share draft or agent-state keys.
- A missing Cloud identity or workspace cannot silently become `personal`.
- The compiler rejects the bare-workspace substitution that caused the defect.
- Logout preserves every scope except the departing one.
- The API-key-to-Firebase path invalidates stale workspace state for every
  consumer, not only persistence.

### Negative

- Existing Cloud workspace-keyed drafts are not automatically visible under
  the new identity-scoped keys until the separate migration decision lands.
- State changed only in memory while ownership is unresolved is lost if the tab
  closes before resolution.
- Two tabs of the same user and workspace still share one scope. Logout in one
  tab removes that scope for both; a cross-tab lease is deferred.
- The module-level transition state remains smaller than the explicit
  state/event/reducer model recommended by `docs/guidance/state-and-effects.md`.

## Notes

Cloud storage layout:

```text
Comfy.Workflow.DraftIndex.v2:<userId>:<workspaceId>
Comfy.Workflow.Draft.v2:<userId>:<workspaceId>:<hashedPath>
Comfy.Workflow.LastActivePath:<userId>:<workspaceId>
Comfy.Workflow.LastOpenPaths:<userId>:<workspaceId>
Comfy.Agent.ThreadId:<userId>:<workspaceId>
Comfy.Agent.WorkflowTabBindings:<userId>:<workspaceId>
Comfy.Agent.ChatTitles:<userId>:<workspaceId>
Comfy.Agent.DeletedThreads:<userId>:<workspaceId>
```
