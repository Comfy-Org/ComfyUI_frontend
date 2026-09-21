# ADR-AGENT-BINDING-0035: Document Identity Gates Persisted Workflow Tab Bindings

Date: 2026-09-19

## Status

Proposed

## Context

The agent panel remembers which editor tab belongs to which server-side
workflow in `agentWorkflowTabBindingStore`, persisted in `localStorage` as a
`workflowId -> tabPath` map so the sidebar stays attached to its workflow
across a reload or a browser restart. Restore recreates previously open drafts
from `localStorage` (`useWorkflowPersistenceV2.restoreWorkflowTabsState`), and
the binding store re-adopts any open tab whose path matches a stored record.

Every anonymous new tab gets the same default path (`createTemporary()` ->
`Unsaved Workflow.json`, suffixed only against every known workflow path in
`workflowLookup`, which a closed browser tab is not part of), and a
browser tab closed without the SPA's own cleanup never releases its record. A
brand-new tab that opens a fresh default draft therefore matches an abandoned
record by path alone, and the CRDT follower pulls another workflow's content
onto an empty canvas before the user asks for anything. From the store's point
of view "same draft, legitimately restored" and "unrelated new tab at a reused
path" are the same event.

Two candidate disambiguators were rejected after reading the restore path:

- A per-page-load nonce (the pattern `agentCrdtDocLifecycle.ts` uses for its
  doc-id cache) refuses every reload and restart by construction, which is the
  feature this store exists to provide.
- Tab identity (`api.clientId` mirrored into `window.name` and
  `sessionStorage`) fails the restart case: `readOpenPaths()` falls back to a
  `localStorage` pointer, so drafts are legitimately restored into a tab with
  no `clientId` continuity at all. It is also reset in a live tab by
  `api.resetSocket()` on an account switch while the workflow tabs stay open.

What every legitimate restore preserves, and every fresh tab lacks, is the
document itself: every fresh tab mints a workflow JSON `id` (the default,
blank and agent tab graphs carry none, so `ensureWorkflowId` always mints),
and every restore preserves the one in the persisted draft.

## Decision

A persisted binding is keyed by tab path and proven by document identity.

- The record becomes `{ tabPath, graphId, confirmedAt }` under a new key,
  `Comfy.Agent.WorkflowTabBindings.v2`. `graphId` is the bound tab's workflow
  JSON `id` at `bind()` time, `null` when the tab was not loaded.
- The legacy `Comfy.Agent.WorkflowTabBindings` map is migrated once, when the
  new key is absent: each string value becomes a record with that path, a
  `null` graph id and a fresh `confirmedAt`. The legacy key is left untouched.
  A rollback build then reads the same v1 map it wrote; had the objects been
  written under the old key, the shipped store would return them as paths and
  break ack adoption (`tabPathFor(...) === undefined`) and `workflowIdFor`'s
  string comparison. Bindings made while rolled back are not migrated
  afterwards.
- A tab may adopt a record only when its graph id is equivalent to the
  record's (`areWorkflowIdsEquivalent`, so a draft whose legacy non-UUID root
  id was re-minted on restore still matches through `legacyId`). A saved
  (non-temporary) workflow adopts by path alone only when the record predates
  ids or the tab's own id is not known yet; a temporary tab never does. A tab
  refused as a draft stays refused for that record while it is open, so
  saving it in place at the record's path (which is what re-targeting a draft
  named `Unsaved Workflow` does) cannot promote it to owner.
- Refusal is non-destructive. A record whose path is occupied by an unproven
  temporary tab does not resolve through `tabPathFor` / `workflowIdFor` while
  that tab is open, but it is neither adopted nor deleted, because it may
  belong to a tab that is still alive in another browser tab or to a draft a
  later boot will restore. Only the proven owner releases a record on close.
- A blocked record is invisible to `tabPathFor` but it is not unowned. Code
  that reads `tabPathFor(id) === undefined` as "nobody owns this id, adopt it"
  (the ack adoption predicates in `useAgentSession` and `AgentPanelRoot`)
  cannot tell the two apart. Those predicates are not changed by this
  decision; today the only way to reach them with a blocked id is a selected
  temporary target without a cloud id, and selection always saves a temporary
  first. The follow-up is a `hasBinding(id)` accessor on the store and
  `!hasBinding(id)` in both predicates.
- Records carry a `confirmedAt` TTL, re-stamped by `bind()` and by a proven
  adoption, and pruned at store creation. The TTL bounds dead records at
  never-reused paths; it is not the correctness gate. The initial value is 30
  days; the value itself is open and needs a product call, since nothing in
  the code fixes it.

The gate lives in the lookups, not only in the adoption watcher, because
navigation consumers (`TabLinkCard`, `useAgentTargetNavigation`) resolve
`tabPathFor` to a tab without consulting `matchesWorkflow`. The watcher
itself reads records ungated: the gated `workflowIdFor` returns `undefined`
for exactly the open, not-yet-proven draft the watcher is trying to adopt, so
a gated watcher would refuse every restore.

Alternatives considered and rejected: re-keying bindings on the graph id
instead of the path (every consumer thinks in paths, and an imported JSON file
can be opened twice with one id), narrowing the fix to the default path (every
`createTemporary(name)` path collides the same way), and deleting a record on
mismatch (would orphan a live tab's binding from an unrelated tab).

## Consequences

### Positive

- A fresh tab never inherits an abandoned workflow, without any dependence on
  `window.name`, `sessionStorage`, or websocket session identity, so the
  behaviour is the same in the browser, Electron and cloud.
- Reload, browser restart and duplicate-tab restore keep the sidebar bound,
  because the restored draft carries the id that proves the binding.
- Refusal cannot damage another live tab's binding.

### Negative

- Upgrade cost for a user with an open, bound, unsaved draft: the migrated
  record can never be claimed by that draft again. On the next boot the thread
  restores with `warnWorkflowUnavailable` ("target no longer available"), the
  thread's server-side pointer still names the old workflow, and the next
  message on that thread is posted without a `workflowId` or draft, so the
  agent edits the old workflow server-side while the canvas shows a document
  that is no longer attached to it; those edits surface only when an
  `agent_active_tab` opens a second tab. Re-targeting the draft saves it as a
  new cloud workflow and moves the thread pointer, orphaning the old workflow
  in the cloud list.
- The same warning toast appears, once per boot, for every user who abandoned
  a bound tab and comes back to a fresh default tab on the same thread. It is
  the correct store outcome, but it is user-visible; skipping it when the
  store reports a blocked record is a possible follow-up.
- A draft saved under the default name outside the agent's own re-targeting
  flow, then reloaded, is a saved workflow at a legacy record's path with no
  id to compare, and the legacy record re-attaches to it until the TTL or the
  next `bind()` at that path retires it. Records written by this build carry
  an id and are not affected.
- Saving or renaming a bound draft leaves its record at the old default path
  (the watcher sees the same tab object). In-session that record blocks a new
  default tab correctly; after a reload it is refused by id and retired by the
  TTL. Pre-existing, now bounded.
- A restored draft that gets a new path suffix (a blank tab already occupied
  its path) loses its binding rather than being re-homed; the record now
  carries the id, so re-homing is a possible additive follow-up.
- Two tabs created from the same imported JSON share a graph id; a fresh
  import at a previously bound path re-attaches the old workflow. Accepted as
  the same document.
- Dead records linger for up to the TTL instead of being removed on sight.
- The `agent_active_tab` push for an unresolvable id still opens a new tab and
  subscribes it; this decision does not change that contract.

## Notes

The store-level, component-level and end-to-end reproductions live next to
the store, in `AgentPanelRoot.test.ts`, and in
`browser_tests/tests/agent/agentStaleWorkflowTabBinding.spec.ts`. Related:
[CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)
(the follower this binding feeds) and
[AGENT-CONTEXT-0028](AGENT-CONTEXT-0028-separate-workflow-references-from-editor-tabs.md)
(editor tabs versus workflow references).
