# ADR-CANVAS-INTERACTION-0035: Agent Node Picking Policy

Date: 2026-09-19

## Status

Proposed

## Context

The agent panel's node selection mode turns the canvas into a picking
surface: clicking a node adds it to the prompt, and none of the product's own
edit paths should mutate the graph. Before this decision the mode was entered
from `AgentPanelRoot.vue`, which wrote `canvas.selectOnly`,
`canvas.allow_dragnodes` and `canvas.multi_select` directly, saved the
previous values in module-level variables, then called
`agentNodeSelectionStore.enter()`. The store's `watch(isActive)` hid the
action bars, sidebar, toasts, minimap and `canvas.show_info`, each with its
own restore slot. Exit ran from four watchers and had to reset every variable
in order. "Picking is on" had two writers (`isActive` and `selectOnly`) and
no derivation between them, the "duplicated authority" pattern
`.agents/checks/adr-compliance.md` flags.

`selectOnly` was only read by the classic canvas: `_processNodeClick`
returned before widget, collapse, slot and resize handling, `processSelect`
kept empty-canvas preservation and accumulation and `select()` refused
non-node items. Vue-rendered nodes, the default on cloud and desktop, gated
pointer handling on `shouldHandleNodePointerEvents`, which was
`!canvasStore.isReadOnly` (`useCanvasInteractions`); nothing under
`src/renderer/extensions/vueNodes` read `selectOnly`. During picking a user
could still type into a Vue text widget, rename a node from its header,
collapse it, resize it, drag a link from a slot, Ctrl+Alt-click a slot to
disconnect it (`useSlotLinkInteraction`) and right-click it for the options
menu (`LGraphNode.vue`); classic DOM widgets read `read_only`
(`DomWidgets.vue`) and stayed editable too. The e2e case in this PR's first
revision dragged a canvas-drawn widget in classic mode, which
`_processNodeClick` does block, so it never exercised the Vue or DOM path.

An intermediate revision of this PR pinned `canvas.read_only`, which closed
those gaps and broke the one interaction the mode needs:
`_processPrimaryButton` turns every press into a pan and `LGraphNode.vue`
makes the whole node `pointer-events-none`, so click-to-select died and the
next revision reverted the pin (alternative C below).

Keyboard paths were a third gap. `Comfy.Canvas.DeleteSelectedItems` checked
`selectOnly` but the bypass, mute, pin, collapse, resize, nudge, paste, group
and subgraph commands did not; Ctrl+Z ran through `changeTracker.ts` and
plain Ctrl+V through `usePaste.ts`, neither via the command store. The picker
leaves nodes selected, so Ctrl+B during picking bypassed the picked nodes.

[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md)
requires picker mode to keep "its current edit and drag guards through
`canvas.selectOnly`" and defers replacing `selectOnly` with an interaction
policy to
[ADR-CANVAS-GESTURE-0029](CANVAS-GESTURE-0029-pointer-gesture-state-machine.md),
whose decision 6 names an `InteractionPolicy`. This ADR is a narrow step
toward that value and leaves the name to 0029.

## Decision

Picking becomes one derived canvas policy, orthogonal to read-only. The
agent store owns the fact; everything else is a projection of it.

1. **One authoritative fact.** `agentNodeSelectionStore.isActive` is the only
   stored representation of "picking is on". It already owns entry, exit,
   Escape and the workflow, target and graph-change exits.
   `AgentPanelRoot.vue` calls `store.enter()` and `store.exit()` and holds no
   canvas save/restore state of its own. Graph replacement is a projection
   boundary: `LGraphCanvas.setGraph()` releases the outgoing items from the
   canvas before it attaches the new graph, dispatches `litegraph:set-graph`
   once, and drops the outgoing graph's selection-store scope only after the
   listeners have run; the panel exits picking synchronously when
   `canvasStore.currentGraph` changes, so the scope is dropped with the
   live-selection projection off and every staged reference, including one
   to a node of another graph scope, survives the switch.
2. **One pure derivation.** `resolvePickingPolicy({ readOnly, picking })` in
   `src/renderer/core/canvas/interaction/pickingPolicy.ts` returns a
   `PickingPolicy` with `canSelectNodes: !readOnly`,
   `canEditNodes: !readOnly && !picking` and `canFocusWidgets: !picking`.
   Only capabilities with distinct policy exist: menus follow `canEditNodes`
   and the CanvasInfo projection reads the `picking` input directly.

   | readOnly | picking | canSelectNodes | canEditNodes | canFocusWidgets |
   | -------- | ------- | -------------- | ------------ | --------------- |
   | false    | false   | true           | true         | true            |
   | false    | true    | true           | false        | false           |
   | true     | false   | false          | false        | true            |
   | true     | true    | false          | false        | false           |

   There is no mode ordering. Space-bar pan, drag-zoom and the lock commands
   write `read_only` synchronously and `canvasStore.isReadOnly` mirrors it,
   so `readOnly` may narrow `canSelectNodes` but never changes what is
   projected onto `selectOnly` or `show_info`. The module has no Vue or store
   imports (`docs/guidance/state-and-effects.md` §4, "Derive everything
   derivable": the policy is computed from its two inputs, never stored and
   synced by hand).

3. **Vue surfaces read the policy through `useCanvasInteractions`.** It keeps
   `shouldHandleNodePointerEvents` (`canSelectNodes`) for selection paths and
   adds `canEditNodes` and `canFocusWidgets` for mutation and focus paths.
   Widget grids, DOM widget layers and node media wrappers use
   `:inert="!canFocusWidgets"`, keyed on picking rather than read-only: the
   app builder's select step sets `read_only` and its promotion overlay must
   keep receiving clicks. Header, resize, context menu, alt-clone, advanced
   toggle, drag-over/drop, collapse, title, right-click, click-to-front
   reordering and the slot link interaction read `canEditNodes`. The slot
   link `finishInteraction` cancels a drop only while picking, read through
   `canvas.selectOnly` rather than `canEditNodes`, so a space-bar pan that
   flips `read_only` mid-drag still completes the drop, and every finish
   calls `captureCanvasState()`. The derivation lives in the composable, not
   `canvasStore`: `agentNodeSelectionStore` already imports `canvasStore`
   (the reverse import is a module cycle), and a store whose only content is
   a `computed` over two other stores is a derivation, not state.
4. **One outward projection onto litegraph.**
   `useCanvasPickingPolicySync`, instantiated once from `GraphCanvas.vue`
   next to `useLitegraphSettings()`, takes over the `Comfy.Graph.CanvasInfo`
   watch from `useLitegraphSettings` so `canvas.show_info` keeps one writer.
   Its explicit sources are the setting, `canvasStore.canvas` and `isActive`;
   it runs with `flush: 'sync'` because `enter()` and `exit()` update the
   store synchronously and the store's chrome watch is created
   synchronously, so a click or key in the same task as `enter()` already
   sees `selectOnly`. It writes `canvas.show_info = canvasInfoEnabled &&
!picking`, then one `draw(false, true)`. Exit has nothing to recompute by
   hand: the policy is derived from the current setting, so a mid-mode
   `Comfy.ToggleCanvasInfo` is honoured.

   **Picking owns `canvas.selectOnly` through `selectOnlyPin.ts`**, a
   module-level registry keyed by canvas instance. Each live sync scope is
   an owner. The first owner records the pre-pick value and installs an
   own accessor for `selectOnly` on that canvas instance whose getter
   returns `true` and whose setter records the written value as the value
   to restore. Further owners join the owner set without touching the
   recorded value. When the last owner releases, because picking ended, the
   canvas was replaced mid-pick or the scope was disposed, the accessor is
   removed and the recorded value is written once through the class's own
   setter. The invariant this buys is structural rather than polled: while
   any owner holds the pin, every reader (`isSelectOnly()`, the classic
   canvas, the commands, paste, drops and history) sees `true` regardless of
   how many `GraphCanvas` scopes are alive (overlapping mounts during a
   route transition, HMR) or what an outside writer does; an outside write
   during picking is neither applied early nor lost, it becomes the value
   restored on exit. The registry lives in the composable's module, not on
   `LGraphCanvas`, which gains no member.

   `allow_dragnodes` and `multi_select` are not projected: `selectOnly`
   already forces accumulation and blocks node drag, and writing them would
   overwrite extension-set values.

5. **One gate for commands, guards at every other mutation site.**
   Graph-mutating core commands declare `mutatesGraph` on `ComfyCommand`,
   either `true` or a predicate evaluated at dispatch, and
   `commandStore.execute` refuses a command whose capability holds while
   `commandPolicyStore.graphMutationsLocked` is `true`, so menus, keybindings
   and the selection toolbox share one check and a command body carries no
   policy of its own. The sync in decision 4 writes that flag next to the
   `selectOnly` pin; `commandPolicyStore` holds nothing else and imports no
   canvas or app module, so the command store reads the policy synchronously
   and the decision, the predicate and the command body all run in the
   dispatching task. A lazy canvas-store import in an earlier revision moved
   the decision past an `await`: the lock could change before the body ran,
   Undo could take a different branch from the one its predicate described,
   and Ctrl+B applied its bypass after the `ChangeTracker` keydown
   checkpoint had already run. The declared set is the four
   `Comfy.Canvas.ToggleSelectedNodes` commands (`Mute`, `Bypass`, `Pin`,
   `Collapse`), `Comfy.Canvas.ToggleSelected.Pin`, `Comfy.Canvas.Resize`,
   the four `Comfy.Canvas.MoveSelectedNodes` commands,
   `Comfy.Canvas.DeleteSelectedItems`,
   `Comfy.Canvas.PasteFromClipboard[WithConnect]`,
   `Comfy.Graph.GroupSelectedNodes`, `Comfy.Graph.ConvertToSubgraph`,
   `Comfy.Graph.UnpackSubgraph`, `Comfy.Graph.FitGroupToContents`,
   `Comfy.Graph.ToggleWidgetPromotion`, `Comfy.Subgraph.SetDescription`,
   `Comfy.Subgraph.SetSearchAliases`, `Comfy.ClearWorkflow`, `Comfy.Undo`
   and `Comfy.Redo`. `useCoreCommands.selectOnly.test.ts` pins the currently
   classified set so a change to it is visible in review; the classification
   is hand-maintained and the test cannot prove that every mutating command
   carries it. `Comfy.Undo` and `Comfy.Redo` declare the predicate
   `!dialogStore.isDialogOpen('global-mask-editor')`: with the mask editor
   open they run its own history, which must keep working during picking,
   and only their workflow-tracker branch is a graph mutation. A command
   without the capability, which today means every extension command, is
   not gated.

   Guards outside the command store read the policy or `canvas.selectOnly`
   through `isSelectOnly()`. `selectOnly` is `true` whenever picking is
   active, but not only then: the pin restores a pre-existing or mid-pick
   `true`, so `isSelectOnly()` can stay `true` after `isActive` turns
   `false`. The guards therefore enforce select-only, of which picking is one
   cause, and they block the classified core commands and the paths listed in
   this decision; an extension command or an unguarded path is not blocked.
   The two non-command keyboard paths get the same guard: the `usePaste.ts`
   handler returns, and the `ChangeTracker` keydown listener snapshots
   `selectOnly` before deferring to the animation frame so `undoRedo` decides
   with the value at keypress and returns `true` so the event is consumed. In
   the classic canvas `_processPrimaryButton` adds `!this.selectOnly` to the
   alt-click clone condition and skips the subgraph IO node, reroute and
   link-segment handling, the group and empty-canvas double-click actions,
   the group title-bar drag callbacks (`_processDraggedItems` snaps
   `selectedItems` on shift or `alwaysSnapToGrid`, which would move the
   picked nodes) and `_processNodeClick`'s `bringToFront` while select-only,
   and `processKey` skips the selected-node `onKeyDown` and `onKeyUp`
   dispatch (the first-party handler steps preview images and extension
   handlers are unrestricted) while keeping its Space and Escape handling;
   node clicks, empty-canvas clicks, panning and the selection rectangle are
   unchanged. The two file-drop paths return while select-only: the document
   `drop` listener in `app.ts` after `preventDefault()` (the browser must not
   navigate to the file) and `useCanvasDrop.ts` `onDrop` for sidebar node,
   model and workflow drags. These are condition edits, not new members.

6. **Chrome keeps reading the store.** Action bars, sidebar, splitter panels,
   selection toolbox, toasts, banner and the queue and error overlays in
   `TopMenuSection.vue` keep gating on `isActive` or `isActionBarsHidden`.
   They are presentation, not canvas interaction. Chrome that owns
   listeners is hidden, not unmounted: `QueueNotificationBannerHost` stays
   mounted with a `hidden` class, because its `useQueueNotificationBanners`
   removes the `promptQueueing`/`promptQueued` listeners on unmount and a run
   queued during picking would lose its banner. `QueueInlineProgressSummary`
   is a pure projection of the execution store and is gated like the legacy
   overlay.

### Compatibility requirements

- `canvas.selectOnly`, `canvas.read_only`, `canvas.allow_dragnodes` and
  `canvas.multi_select` keep their types, defaults and meaning. No member is
  added to `LGraphCanvas`, `LGraphNode`, `LGraph` or `Subgraph`. Entity
  callbacks and `node.widgets` access are untouched.
- While picking is active on a canvas, `canvas.selectOnly` reads `true` for
  every reader. A value written to it during picking is recorded and becomes
  the value restored when picking ends; a value it held before picking is
  restored otherwise. The restore happens exactly once, when the last sync
  owner releases.
- Classic picking keeps node selection, empty-canvas preservation, panning
  and the selection rectangle; alt-click clone, reroute and link drags from
  the canvas, link menus, group title-bar drags, click-to-front reordering,
  selected-node key callbacks and the group and empty-canvas double-click
  actions are suppressed. The
  existing `LGraphCanvas.selectOnly.test.ts` behavioral assertions are retained
  and gain rows for each suppressed path.
- `ADR-CANVAS-SELECTION-0028`'s compatibility clause still holds: picker
  mode keeps node-only accumulation, empty-canvas preservation and its edit
  and drag guards through `canvas.selectOnly`, now a projection rather than
  a second source. Its deferred `InteractionPolicy` item stays with 0029.
- Vue node DOM structure and `data-*` attributes used by e2e tests do not
  change. `shouldHandleNodePointerEvents` keeps its name and meaning.
- `litegraph:set-graph` keeps its detail and fires exactly once per graph
  replacement, from `setGraph()` with the new graph attached and the canvas
  selection already empty; `openSubgraph()` delegates to it and
  `canvas.subgraph` is a plain field that emits nothing, where its setter
  used to dispatch a second event naming the same subgraph as both `oldGraph`
  and `newGraph` while the outgoing graph was still attached. A listener that
  deselects during the event finds nothing to deselect, so it cannot touch
  the incoming graph's saved selection. The outgoing graph's selection-store
  scope is dropped after the event by `setGraph()` itself; `clear()` stays
  parameterless and operates on the attached graph only.

### Deferred decisions

- Whether extension commands should declare `mutatesGraph`, and whether
  the capability should also gate `read_only`.
- Whether the minimap follows the same derivation or keeps flipping the
  user's setting.
- Whether picking should lock `GraphCanvasMenu`'s lock button, which can flip
  `read_only` mid-mode and turn every click into a pan.
- [PR #17730](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17730)
  teleports `AgentGraphActivityBar` into the canvas panel during agent turns,
  ungated by `isActive`, and its "View nodes" moves the viewport. Whether it
  hides during picking is that PR owner's decision.

## Alternatives considered

- **A: keep `selectOnly` and add per-surface guards.** Zero API change, but
  `selectOnly` is a plain class field with no reactive mirror, so every Vue
  surface would read `agentNodeSelectionStore.isActive` directly, spreading
  the second source across about ten files. `litegraphUtil.ts` already
  documents that every new edit path must opt in, which is exactly how the
  Vue and DOM widget paths were missed.
- **B with mode ordering (earlier draft).** `readOnly` won and produced a
  `pan` mode from which `selectOnly` was derived. Both reviews found that a
  space-bar press mid-pick then wrote `selectOnly = false` and disabled every
  `isSelectOnly()` guard for the duration of the hold. The orthogonal table
  above replaces it.
- **C: pin `read_only` with picking carve-outs.** Every surface honours
  `read_only`, but selection needs exceptions at `_processPrimaryButton`,
  `LGraphNode.vue`, `NodeWidgets.vue` and the Vue select paths; space-bar
  pan and drag-zoom save and restore `read_only` and would fight the pin,
  which is why `appModeStore` installs a re-pin watcher, the
  effect-writes-what-effect-reads loop
  `docs/guidance/state-and-effects.md` §5 warns against, and it conflicts
  with 0029 decision 6.
- **D: a `pick` app mode in `appModeStore`.** Reuses `enforceReadOnly` and so
  inherits C's selection failure; `autoEnableVueNodes` would flip a classic
  user's renderer setting on opening the picker; app modes are persisted
  layout state while picking is a transient gesture.
- **E: a scope-local pin that re-pins on each watch run (earlier draft).**
  Each sync scope remembered the value it overwrote and wrote it back only
  while `selectOnly` still held `true`. Two live scopes still restored the
  first scope's value when the first was disposed while the second and
  picking remained active, and an outside `false` written mid-pick stayed in
  force until an unrelated watched source changed, because `selectOnly` is
  not reactive. Both intervals reopened every guard that reads
  `selectOnly`, contradicting the lockdown invariant, so the shared owner
  registry and accessor in decision 4 replace it.

## Consequences

### Positive

- One fact, one pure derivation, one projection. Exit recomputes `show_info`
  from the current setting instead of restoring a saved copy, so a mid-mode
  setting change is respected; the one value exit hands back is
  `selectOnly`, which the pin restores to its recorded value exactly once (the
  sidebar tab and minimap slots remain in the store).
- Widgets (Vue, DOM, canvas-drawn), titles, collapse, resize, link drags,
  slot disconnects, context menus, paste, undo and the mutation commands are
  blocked while picking in both renderers; click-to-select, space-bar pan,
  zoom and lock behave as they do today.
- `selectOnly` cannot be observed as anything but `true` while picking, so
  the command gate and the per-site guards hold without each site having to
  know about owners, scopes or extension writers.
- The policy is table-testable without a canvas or DOM, the classified
  command inventory is one asserted list that makes changes reviewable, and
  the remaining guard list is finite and reviewable.

### Negative

- A new mutating core command declares `mutatesGraph` and nothing checks
  that it does; the classic canvas, paste, drop and history paths keep
  per-site guards, so a new keyboard or pointer mutation path must still opt
  in.
- `commandPolicyStore.graphMutationsLocked` is a second projection of
  `isActive`, written by the same sync as the `selectOnly` pin, kept because
  the command store cannot import the agent or canvas stores without
  pulling the app module into every command-store consumer.
- An extension that sets `canvas.selectOnly` itself reads `true` while
  picking and sees its own write take effect only once picking ends. No
  first-party writer outside the sync exists; the extension corpus has not
  been scanned.
- While pinned, `selectOnly` is an own accessor on the canvas instance
  rather than the prototype accessor; code that redefines that property on
  the instance mid-pick would defeat the pin.
- The `show_info` settings write moves from the platform layer into a
  renderer composable, so two composables now sync settings onto litegraph.

## Notes

Implementation:
[PR #18066](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18066).

The sequence number collides with open
[PR #18106](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18106)
(`CRDT-RECONCILE-0035`); four ADRs already share `0028`, so this is tolerable
by precedent. Re-check at rebase. `ADR-CANVAS-GESTURE-0029` migration step 5
("Introduce `InteractionPolicy` and derive the legacy mode flags from it")
should start from `resolvePickingPolicy` for the pick case; 0029 is not
edited in this PR.

Related decisions:
[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md)
owns selection state and requires picker guards through `canvas.selectOnly`;
[ADR-CANVAS-GESTURE-0029](CANVAS-GESTURE-0029-pointer-gesture-state-machine.md)
owns the full `InteractionPolicy`; and
[ADR-ECS-0008](ECS-0008-entity-component-system.md) places behaviour in
systems and composables rather than entity methods.
