# Change Tracker (Undo/Redo System)

The `ChangeTracker` class (`src/scripts/changeTracker.ts`) manages undo/redo
history by comparing serialized graph snapshots.

## How It Works

`captureCanvasState()` is the core method. It:

1. Serializes the current graph via `app.rootGraph.serialize()`
2. Deep-compares the result against the last known `activeState`
3. If different, pushes `activeState` onto `undoQueue` and replaces it

**It is not reactive.** Connectivity and synchronous selection actions capture
completed edits through their bound owner. Unmigrated graph edits require
`captureCanvasState()` triggers.

**INVARIANT:** `captureCanvasState()` asserts that it is called on the active
workflow's tracker. Calling it on an inactive tracker logs a warning and
returns early, preventing cross-workflow data corruption.

## Explicit edit completion

Connectivity captures its completed edit through a tracker bound to the root
graph state, even without a canvas gesture. Same-root reentrant connections and
multi-link drops group into one snapshot. A veto without applied mutations adds
no history. If a callback interrupts an edit after mutation, history preserves
the applied topology and the original exception propagates.

Completion serializes the owner's graph rather than the active canvas. Graph
replacement, owner rebinding, and workflow unload invalidate the old completion.
Nonlocal provenance, graph loading, restoration, and capture suppression do not
create local history. Snapshot undo remains whole-document undo, including when
local callbacks also perform remote mutations.

Legacy capture is suppressed inside an explicit edit. An outer legacy
transaction still owns its grouped capture, and unmigrated operations retain
gesture fallback. Text editors retain local undo during their sessions. See
[the connectivity completion decision](../adr/WORKFLOW-HISTORY-0060-connectivity-edit-completion.md)
for the ownership tradeoffs.

Synchronous selection actions reuse the same completion scope. Paste, duplicate,
delete, resize, collapse, pin, mode, arrangement, and color batches complete
against the originating graph, after synchronous callbacks finish. Applied
membership, field, and geometry changes mark the scope; empty, refused, and
unchanged actions do not capture unrelated pending edits. Arrangement can opt
out of capture. Mode toggles retain shallow selection while resize, collapse,
and pin retain descendant expansion.

Mutation notes do not open a scope. Programmatic field assignments outside an
explicit action therefore retain their existing history behavior. Async work
must not use a synchronous scope across suspension.

## Automatic Triggers

These are set up once in `ChangeTracker.init()`:

| Trigger                             | Event / Hook                                       | What It Catches                                     |
| ----------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Keyboard (non-modifier, non-repeat) | `window` `keydown`                                 | Shortcuts, typing in canvas                         |
| Modifier key release                | `window` `keyup`                                   | Releasing Ctrl/Shift/Alt/Meta                       |
| Mouse click                         | `window` `mouseup`                                 | General clicks on native DOM                        |
| Canvas mouse up                     | `LGraphCanvas.processMouseUp` override             | LiteGraph canvas interactions                       |
| Number/string dialog                | `LGraphCanvas.prompt` override                     | Dialog popups for editing widgets                   |
| Context menu close                  | `LiteGraph.ContextMenu.close` override             | COMBO widget menus in LiteGraph                     |
| Active input element                | `bindInput` (change/input/blur on focused element) | Native HTML input edits                             |
| Prompt queued                       | `api` `promptQueued` event                         | Dynamic widget changes on queue                     |
| Graph cleared                       | `api` `graphCleared` event                         | Full graph clear                                    |
| Transaction end                     | `litegraph:canvas` `after-change` event            | Batched operations via `beforeChange`/`afterChange` |

## When You Must Call `captureCanvasState()` Manually

The automatic triggers above are designed around LiteGraph's native DOM
rendering. They **do not cover**:

- **Vue-rendered widgets** — Vue handles events internally without triggering
  native DOM events that the tracker listens to (e.g., `mouseup` on a Vue
  dropdown doesn't bubble the same way as a native LiteGraph widget click)
- **Unmigrated programmatic mutations** — Applying a template and editing
  workflow metadata still require their own capture boundaries
- **Async operations** — File uploads, API calls that change widget values
  after the initial user gesture

### Pattern for Manual Calls

```typescript
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

// After mutating the graph:
useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState()
```

### Existing Manual Call Sites

These locations call `captureCanvasState()` directly:

- `WidgetSelectDropdown.vue` — After dropdown selection and file upload
- `NodeSearchBoxPopover.vue` — After adding a node from search
- `builderViewOptions.ts` — After setting default view
- `useSelectionOperations.ts` — After asynchronous rename
- `useGroupMenuOptions.ts` — After group operations
- `useSubgraphOperations.ts` — After subgraph enter/exit
- `useCanvasRefresh.ts` — After canvas refresh
- `useCoreCommands.ts` — After metadata/subgraph commands
- `appModeStore.ts` — After app mode transitions

`workflowService.ts` calls `captureCanvasState()` indirectly via
`deactivate()` and `prepareForSave()` (see Lifecycle Methods below).

> **Deprecated:** `checkState()` is an alias for `captureCanvasState()` kept
> for extension compatibility. Extension authors should migrate to
> `captureCanvasState()`. See the `@deprecated` JSDoc on the method.

## Lifecycle Methods

| Method                 | Caller                          | Purpose                                                                                                                                          |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `captureCanvasState()` | Event handlers, UI interactions | Snapshots canvas into activeState, pushes undo. Asserts active tracker.                                                                          |
| `deactivate()`         | `beforeLoadNewGraph` only       | `captureCanvasState()` (skipped during undo/redo) + `store()`. Freezes state for tab switch. Must be called while this workflow is still active. |
| `prepareForSave()`     | Save paths only                 | Active: calls `captureCanvasState()`. Inactive: no-op (state was frozen by `deactivate()`).                                                      |
| `store()`              | Internal to `deactivate()`      | Saves viewport scale/offset, node outputs, subgraph navigation.                                                                                  |
| `restore()`            | `afterLoadNewGraph`             | Restores viewport, outputs, subgraph navigation.                                                                                                 |
| `reset()`              | `afterLoadNewGraph`, save       | Resets initial state (marks workflow as "clean").                                                                                                |

## Transaction Guards

For operations that make multiple changes that should be a single undo entry:

```typescript
changeTracker.beforeChange()
// ... multiple graph mutations ...
changeTracker.afterChange() // calls captureCanvasState() when nesting count hits 0
```

The `litegraph:canvas` custom event also supports this with `before-change` /
`after-change` sub-types.

## Key Invariants

- `captureCanvasState()` asserts it is called on the active workflow's tracker;
  inactive trackers get an early return (and a warning log)
- `captureCanvasState()` is a no-op during `loadGraphData` (guarded by
  `isLoadingGraph`) to prevent cross-workflow corruption
- `captureCanvasState()` is a no-op during undo/redo (guarded by
  `_restoringState`) to prevent undo history corruption
- `captureCanvasState()` is a no-op when `changeCount > 0` (inside a transaction)
- `undoQueue` is capped at 50 entries (`MAX_HISTORY`)
- `graphEqual` ignores node order and `ds` (pan/zoom) when comparing
