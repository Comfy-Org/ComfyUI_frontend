# 11. In-App Agent Graph-State Integration

Date: 2026-06-25

## Status

Proposed

## Context

The In-App Agent (V0, target ~2026-07-13) adds a server-side ComfyUI agent the user chats with
from a side panel. A hard product requirement is that the agent can **read the user's live
workflow** and **write workflow changes back onto the canvas**. This ADR records the frontend
graph-state and synchronization design for that capability. It is intentionally written as
"TDD-as-code": a design record, ahead of the implementation PRs.

This decision builds directly on:

- [ADR-0001 (Merge LiteGraph)](0001-merge-litegraph-into-frontend.md) and
  [ADR-0003 (Centralized Layout Management with CRDT)](0003-crdt-based-layout-system.md), which
  established a Yjs CRDT store as the single source of truth for spatial state and a command/
  observer model for mutations.
- The long-term architectural direction RFC ([issue #4661]), which makes a CRDT-mediated state
  layer the foundation for multiplayer — and frames the agent as **just another client** of a
  per-graph room.

### Forces at play

1. **A second writer.** Until now the only writer to a workflow is the local user. The agent
   introduces a second, remote writer to the _same_ graph. We need conflict handling, not
   last-write-wins.
2. **The backend is server-authoritative.** The cloud backend (`Comfy-Org/cloud` PR #4432)
   introduces a mutable server-side **`workflow_draft`** (full save-format JSON + integer
   `version`), commits edits with **compare-and-swap on `version`**, and pushes results to the
   browser as a **full-document replace** over an existing **Redis-PubSub → WebSocket** bridge
   (`channel:ws:{workspaceId}:u:{userId}`). Inbound chat turns go through ingest `/api/agent/*`.
3. **The frontend is moving toward decentralized CRDT.** Per ADR-0003 / #4661 the end-state is
   per-graph rooms with mutation relay and CRDT merge — _not_ server-authoritative full-document
   replace. The V0 backend model and the FE end-state are different shapes.
4. **Timeline.** V0 ships in ~3 weeks. The CRDT migration of the _data-model_ class of state
   (node existence, widget values) is still in progress; only the _layout_ class is fully on the
   Yjs store today. A true per-mutation CRDT sync for the agent is not ready for V0.
5. **No throwaway work.** Whatever we ship for V0 must be a strict subset of the #4661 end-state.

### What V0 is NOT

- The agent does **not** draw, animate, or incrementally lay out nodes on the canvas.
- The agent does **not** submit/run the workflow — the user clicks the existing Run button.
- The agent is **not** aware of viewport state (zoom/pan/cursor) — that is FE-only ephemeral
  state and is never synced.

## Decision

For V0 the frontend treats the **server `workflow_draft` as the authority**, integrates agent
writes as **full-document replaces guarded by `version`**, and frames the whole interaction as a
**room-per-graph** model so it is forward-compatible with the CRDT end-state.

### Graph-state model

| State class                                                | Source of truth (V0)                                   | Synced to agent? |
| ---------------------------------------------------------- | ------------------------------------------------------ | ---------------- |
| Save-format **data model** (nodes, links, widgets, groups) | server `workflow_draft.content`                        | read + write     |
| **Layout** (positions/sizes/reroutes)                      | within `content`; mirrors Yjs `layoutStore` (ADR-0003) | within content   |
| **Selection** (selected node ids)                          | browser, sent per turn                                 | per-turn input   |
| **Viewport** (zoom/pan/cursor)                             | browser only                                           | never            |

- Each `workflow_draft` is a **room**. V0 has up to two writers: the human (via autosave-to-draft)
  and the agent. The browser keeps a draft's tab **alive in memory** while connected so agent
  pushes apply even when the tab is unfocused (lazy apply on refocus) — the CRDT room behavior,
  minus true merge.
- The browser **autosaves canvas edits into the draft** so the server copy reflects unsaved work
  before a turn. Agent awareness then reduces to "read the draft + read the selection ids".

### Synchronization & conflict handling

The agent→browser push is a `draft_patch { workflow_id, content, version, base_version }`.

```
agent commits draft (CAS version N → N+1)
  → draft_patch { content, version: N+1, base_version: N } over Redis → WS
browser:
  tab.version == base_version  → apply full replace, adopt new version   (happy path)
  tab.version != base_version  → MERGE DIALOG: [Accept agent's] [Keep mine] [Open in new tab]
```

- **Apply** = load the full save-format graph into the target tab (a destructive variant of the
  existing `loadGraphData` path) and adopt `version` as the tab's new base.
- **Conflict** (user edited the graph during the agent's turn) surfaces a dialog rather than
  silently clobbering. We explicitly reject **graph-locking** as the primary mechanism: a
  lost/duplicated backend message could leave the graph _permanently_ locked. A presentational
  "agent editing…" hint MAY be driven by the optional backend edit-turn lease, but it is never on
  the correctness path.
- The agent can also target a **new tab** (`target: "new_tab"`) for unrelated requests — a
  non-destructive load, no conflict possible.

### Awareness & run

- A chat turn carries `{ content, selection?: NodeId[], attachments?, target }`. `selection` is
  the set of node ids from the canvas (the panel's `@`-tag chips). The agent reads the draft data
  model server-side; the browser does not scrape the live graph.
- The agent never runs the workflow in V0; after a write it tells the user the graph is loaded and
  to click Run. Submit is gated off for the in-app client.

### Migration path to the CRDT end-state (#4661)

This is the load-bearing reason the V0 shape is acceptable. The transition is a payload swap, not
a rewrite:

1. **V0:** full-document `draft_patch`; convergence via `version` CAS + merge dialog.
2. **When the data-model class finishes migrating to the Yjs store:** `draft_patch` gains a
   **mutation-list** variant applied via `layoutStore.applyOperation(op)` tagged
   `LayoutSource.External` with a dedicated agent actor id (the store already tracks
   source/actor). Full replace remains the fallback for large rewrites / new tabs.
3. **Multiplayer:** server relays mutations; both client and server write + reconcile via CRDT
   merge, retiring the merge dialog for fine-grained edits. The room model, actor/source tracking,
   and the Redis channel are unchanged.

### Alternatives considered

- **Build true CRDT (Yjs) agent sync in V0** — rejected: data-model CRDT migration incomplete;
  misses the timeline; high risk.
- **Always open a new tab for agent output** — rejected: simplest, but fails "update what I'm
  looking at" and causes tab sprawl.
- **Graph-locking / "agent mode" that blocks user edits** — rejected as primary mechanism:
  permanent-lock dead-end risk on message loss.
- **Browser scrapes the live graph per turn** — rejected: invites client/server drift;
  autosave-to-draft keeps the canonical server copy current instead.

## Consequences

### Positive

- Hits the V0 timeline by reusing the backend draft + the existing Redis→WS transport; no new
  realtime infrastructure on the frontend.
- A clean, documented bridge to the #4661 CRDT end-state: room-per-graph, agent-as-client, and the
  ADR-0003 source/actor model all carry forward unchanged.
- Conflicts never silently destroy user work; the dialog appears only in the genuine
  concurrent-edit case.
- Awareness is minimal and robust: read the draft + the selection ids.

### Negative

- Full-document replace is coarse-grained: a concurrent user edit during an agent turn collides
  and must go through the merge dialog rather than merging automatically.
- Introduces a frontend-owned **base-`version` lifecycle** (obtain on draft open, bump on apply
  and on autosave). If this drifts, the merge dialog can mis-fire — this is the main correctness
  risk to get right.
- The agent→browser event schema becomes a **cross-repo contract** (Go ⇄ TS); it must be
  versioned and drift-guarded.
- A temporary semantic gap with V0 product copy ("Agent generation does not impact the graph")
  that must be reconciled now that write-to-graph is in scope.

## Notes

### Open questions

1. **Tab closed mid-edit.** If the user closes the draft's tab while the agent is editing, do
   pending changes invalidate (and report back to the agent) or persist server-side and reopen on
   a new tab? Affects the room lifecycle.
2. **Base-`version` lifecycle.** Exact points where the tab obtains/bumps its base `version` so
   the merge dialog cannot mis-fire or desync.
3. **Event schema home & versioning.** Where the shared `draft_patch` / `agent_message_delta` /
   `agent_tool_call` / `agent_message_done` contract lives and how drift is caught.

### References

- [ADR-0001](0001-merge-litegraph-into-frontend.md), [ADR-0003](0003-crdt-based-layout-system.md)
- RFC: Long-Term Architectural Direction for ComfyUI_frontend (issue #4661)
- Backend slice: `Comfy-Org/cloud` PR #4432 (`workflow_draft`, ingest `/api/agent/*`, Redis PubSub)
- Existing FE entry points: `src/renderer/core/layout/store/layoutStore.ts`,
  `src/renderer/core/layout/operations/layoutMutations.ts`, `src/scripts/app.ts` (`loadGraphData`)
