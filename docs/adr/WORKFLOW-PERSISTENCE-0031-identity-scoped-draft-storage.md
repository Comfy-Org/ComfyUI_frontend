# ADR-WORKFLOW-PERSISTENCE-0031: Identity-Scoped Draft Storage

Date: 2026-09-09

## Status

Proposed

## Context

Workflow drafts, the draft index, and tab restore pointers live in
`localStorage`, keyed by workspace id. The workspace id is read from
`sessionStorage` (`Comfy.Workspace.Current`), which is per tab. The signed-in
Firebase user is persisted in IndexedDB, which is per origin. The two storage
mediums have different lifetimes, so the keys under which drafts are written can
name a workspace that belongs to a different user than the one currently signed
in.

A sequence of fixes narrowed the resulting data loss and cross-user leakage
without removing the cause:

- https://github.com/Comfy-Org/ComfyUI_frontend/pull/8517,
  https://github.com/Comfy-Org/ComfyUI_frontend/pull/8519 and
  https://github.com/Comfy-Org/ComfyUI_frontend/pull/8520 introduced the
  workspace-keyed V2 draft store and its V1 migration.
- https://github.com/Comfy-Org/ComfyUI_frontend/pull/14266 wiped all draft
  storage on logout so the next user could not see the previous user's drafts.
- https://github.com/Comfy-Org/ComfyUI_frontend/pull/14290,
  https://github.com/Comfy-Org/ComfyUI_frontend/pull/14306 and
  https://github.com/Comfy-Org/ComfyUI_frontend/pull/14337 added a
  transitioning state around logout and workspace switches so in-flight
  debounced writes would not resurrect wiped data.

The remaining gaps are listed in
https://github.com/christian-byrne/blocked-on-christian/issues/522#issuecomment-5609244580.
The ones this ADR addresses:

- Auth-state transitions that are not a logout (expired session restored as a
  different user, account switch in another tab, user resolved before the
  workspace store is ready) do not enter the transitioning state, so a debounced
  write can land under the previous identity's key.
- The logout wipe is unconditional. It destroys the drafts of the departing
  user in every workspace they had opened in that browser, including drafts
  that were never touched during the session.
- Two users sharing a workspace id (a personal workspace named `personal`, or a
  team workspace both belong to) share one set of keys, so one user's drafts
  are readable by the other after login.

The behaviour these keys need is the same as a database row scoped by tenant:
each row has exactly one owner, writes are rejected while the owner is unknown,
and a change of owner is fenced so no write from the old owner's transaction can
commit after the new owner has started. `docs/guidance/state-and-effects.md`
adds a second constraint: the logout sequence is a command with an explicit
order of effects, not a chain of watchers reacting to each other.

## Decision

### Keys are scoped by resolved identity

`resolveStorageScope(userId, workspaceId)` in
`src/platform/workflow/persistence/base/storageKeys.ts` is the single source of
the storage scope. Non-cloud builds resolve to `personal`. Cloud builds resolve
to `${userId}:${workspaceId}` when both a user and a workspace are known and
`null` otherwise; a missing `Comfy.Workspace.Current` entry is not defaulted to
`personal`, because a cloud tab with no workspace has no owner yet. Draft
payloads, the draft index and the tab restore pointers (`lastActivePath`,
`lastOpenPaths`) are all keyed by the resolved scope, never by the bare
workspace id.

`storageIO.ts` holds the identity (`setStorageIdentity`) and exposes
`getStorageScope()`; nothing outside the persistence module computes a key.

### Writes pass a tri-state gate

`getStorageWriteGate()` returns `open`, `deferred` or `closed`:

- `closed` when `localStorage` is unavailable. Writes are dropped, as before.
- `deferred` when the store is transitioning or the scope is `null`. The
  persistence composable skips the write and keeps the in-memory workflow as
  the authority. The next change after the gate opens persists the full state.
- `open` otherwise.

A `null` scope is the "owner unknown" case. Refusing writes there is what stops
a debounced save from landing under a key that later turns out to belong to a
different user.

### Identity swaps are fenced

`useWorkflowPersistenceV2.ts` tracks the last resolved user id. When
`onUserResolved` fires with an id other than the tracked one (including the
first resolution from no user), or `onUserLogout` fires, it calls
`fenceIdentityChange()`: cancel the debounced save, enter the transitioning
state, and drop the `lastSavedJsonByPath` cache so the first write under the
new scope is not suppressed by a hash computed under the old one. A repeat
resolution of the same user (token refresh) does not fence. The fence is
released only once the workspace store has concluded initialisation (`ready`
with an active workspace, or `error`), because the scope is not resolvable
before that. Until the next `onUserResolved`, a logout fence stays in place;
a tab that observes another tab's logout therefore stays read-only rather than
writing under an identity that no longer exists.

### Logout wipes one scope, from the command

`useAuthActions.logout` captures `getStorageScope()` before calling
`authStore.logout()`, then, after `prepareWorkflowLogoutTransition()`, calls
`clearWorkflowStorageForScope(departingScope)`. `onUserLogout` in the
persistence composable no longer wipes anything; it only fences and clears the
identity. `clearAllWorkflowStorage` is removed.

The wipe lives in the command because the command is the only place that knows
the departing scope before the auth store forgets it. A watcher on the user
becoming `null` cannot know which scope to clear.

### Legacy data is migrated once per scope

`migrateWorkspaceToScope(workspaceId, scope)` copies the workspace-keyed index,
payloads and restore pointers to the scoped keys the first time a scope is
resolved that has no index. The destination index is written last so a partial
copy is never observed as complete. On failure every destination artifact the
copy produced (payloads, restore pointers, index) is removed and the source is
left intact, so a retry starts from the same state. On success the source
payloads, index and restore pointers are removed. If the source index still
exists but the destination index is already present, an earlier run committed
and was interrupted before its source cleanup; the migration only finishes that
cleanup and does not copy again, so the committed destination is never
overwritten by stale source data.

The first user to sign in on a browser therefore claims any pre-existing
workspace-keyed drafts. This is accepted: before this change those drafts were
already readable by whoever signed in, and the alternative of discarding them
is a data loss for the common single-user case.

## Deferred decisions

- `resetForIdentityChange()` in `teamWorkspaceStore.ts` is called from the auth
  store's `onAuthStateChanged` and clears workspace state before the persistence
  fence observes the new user. The ordering is currently benign because the
  fence blocks writes until the store is `ready` again, but it is an implicit
  dependency between two effects and should become an explicit sequence.
- `prepareWorkflowLogoutTransition()` overwrites a `workspace` transition reason
  with `logout`. The two reasons are not yet distinguished by any reader, so the
  overwrite has no observable effect; a reducer over
  `WorkflowStorageState` would make the precedence explicit.
- Modelling the write gate, transition and identity as one reducer with named
  events, plus write leases so a debounced save carries the scope it was
  scheduled under, is the shape `state-and-effects.md` prescribes. The current
  change keeps the existing module-level state and adds the minimum needed to
  close the data-loss gaps.
- `useNewUserService.ts` reads the literal key `DraftIndex.v2:personal`. It is
  correct for non-cloud builds and is not part of the cloud identity problem.
- Two tabs of the same user in the same workspace share one scope. Logging out
  in one tab wipes that scope, so unsaved drafts in the other tab are removed
  while it is still open; that tab is fenced and cannot write them back. This
  is the pre-existing multi-tab behaviour of the logout wipe, now narrowed to
  one scope. A per-tab claim on the scope (a lease keyed by tab id, released on
  `pagehide`) would let the wipe skip scopes another live tab still holds; it
  needs a cross-tab protocol and belongs with the reducer work above. Owner:
  the workflow persistence maintainers.
- A tab fenced by another tab's logout stays fenced until its own auth state
  resolves a user again. It does not re-open on its own because it cannot
  know whether the departing scope is still valid. Surfacing this to the user
  (read-only indicator, prompt to sign in) is UI work outside this ADR.

## Alternatives considered

- **Wipe on every auth-state change, not only logout.** Closes the leak but
  turns a session refresh into data loss, and still depends on the wipe racing
  ahead of the next debounced write.
- **Keep workspace-keyed storage and store the owner uid alongside each
  entry.** Requires every reader to filter by owner and every writer to stamp
  it; a scoped key does both by construction.
- **Store drafts in IndexedDB alongside the Firebase user so the mediums
  match.** Correct in principle, but a storage-engine migration for all draft
  data, and it does not by itself gate writes during identity transitions.
- **Reducer and leases now.** Rejected for this change to keep the PR under the
  300-line non-test budget and reviewable; recorded above as deferred.

## Consequences

### Positive

- Two users on one browser never read or overwrite each other's drafts, even
  when they share a workspace id.
- Logout removes only the departing user's data in the scope they were in;
  drafts in their other workspaces survive.
- No write can commit while the owner is unknown or changing.

### Negative

- Existing workspace-keyed drafts are attributed to the first user who signs in
  after the upgrade.
- Writes made while the gate is `deferred` are not queued; if the tab closes
  before the gate opens, changes made during the transition are lost. This is
  the same window that already existed for the transitioning state.
- One more key segment in `localStorage`; total storage use is unchanged after
  migration because source keys are removed.

## Notes

Storage layout after this change, cloud build:

```text
Comfy.Workflow.DraftIndex.v2:<uid>:<workspaceId>
Comfy.Workflow.Draft.v2:<uid>:<workspaceId>:<hashedPath>
Comfy.Workflow.LastActivePath:<uid>:<workspaceId>
Comfy.Workflow.LastOpenPaths:<uid>:<workspaceId>
```

Non-cloud builds keep `personal` as the scope, so their keys are unchanged.
