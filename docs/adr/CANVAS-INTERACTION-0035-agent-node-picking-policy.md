# ADR-CANVAS-INTERACTION-0035: Agent Node Picking Policy

Date: 2026-09-19

## Status

Proposed

## Context

The agent panel's node selection mode turns the canvas into a picking
surface: clicking a node adds it to the prompt, and no graph mutation should
happen. The mode is entered from `AgentPanelRoot.vue`, which writes
`canvas.selectOnly`, `canvas.allow_dragnodes` and `canvas.multi_select`
directly (L958-962), saves the previous values in module-level variables
(L874-877), then calls `agentNodeSelectionStore.enter()`. The store's
`watch(isActive)` hides the action bars, sidebar, toasts, minimap and (on this
branch) `canvas.show_info`, each with its own restore slot. Exit runs from
four watchers and must reset every variable in order. "Picking is on" has two
writers (`isActive` and `selectOnly`) and no derivation between them, the
"duplicated authority" pattern `.agents/checks/adr-compliance.md` flags.

`selectOnly` is only read by the classic canvas: `_processNodeClick` returns
before widget, collapse, slot and resize handling (`LGraphCanvas.ts` L2755),
`processSelect` keeps empty-canvas preservation and accumulation
(L4550-4556) and `select()` refuses non-node items (L4591). Vue-rendered
nodes, the default on cloud and desktop, gate pointer handling on
`shouldHandleNodePointerEvents`, which is `!canvasStore.isReadOnly`
(`useCanvasInteractions.ts` L34); nothing under
`src/renderer/extensions/vueNodes` reads `selectOnly`. During picking a user
can still type into a Vue text widget, rename a node from its header,
collapse it, resize it, drag a link from a slot, Ctrl+Alt-click a slot to
disconnect it (`useSlotLinkInteraction.ts` L697-707) and right-click it for
the options menu (`LGraphNode.vue` L435-444); classic DOM widgets read
`read_only` (`DomWidgets.vue` L119) and stay editable too. The e2e case
dropped in `f58339a` dragged a canvas-drawn widget in classic mode, which
L2755 does block, so it never exercised the Vue or DOM path.

Pinning `canvas.read_only` (`bf70f9c`) closed those gaps and broke the one
interaction the mode needs: `_processPrimaryButton` turns every press into a
pan (L2453-2457) and `LGraphNode.vue` L24-28 makes the whole node
`pointer-events-none`, so click-to-select died and the pin was reverted in
`5ff9afc`.

Keyboard paths are a third gap. `Comfy.Canvas.DeleteSelectedItems` checks
`selectOnly` (`useCoreCommands.ts` L949) but the bypass, mute, pin, collapse,
resize, nudge, paste, group and subgraph commands do not; Ctrl+Z runs through
`changeTracker.ts` L490-503 and plain Ctrl+V through `usePaste.ts` L200,
neither via the command store. The picker leaves nodes selected, so Ctrl+B
during picking bypasses the picked nodes.

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
2. **One pure derivation.** `resolvePickingPolicy({ readOnly, picking })` in
   `src/renderer/core/canvas/interaction/pickingPolicy.ts` returns a
   `PickingPolicy` with `canSelectNodes: !readOnly`,
   `canEditNodes: !readOnly && !picking`,
   `canOpenMenus: !readOnly && !picking`, `canFocusWidgets: !picking` and
   `suppressesCanvasInfo: picking`:

   | readOnly | picking | canSelect | canEdit | canOpenMenus | canFocusWidgets | suppressInfo |
   | -------- | ------- | --------- | ------- | ------------ | --------------- | ------------ |
   | false    | false   | true      | true    | true         | true            | false        |
   | false    | true    | true      | false   | false        | false           | true         |
   | true     | false   | false     | false   | false        | true            | false        |
   | true     | true    | false     | false   | false        | false           | true         |

   There is no mode ordering. Space-bar pan, drag-zoom and the lock commands
   write `read_only` synchronously (`LGraphCanvas.ts` L3959-3963,
   L3984-3990, L2271-2277; `useCoreCommands.ts` L437-461) and
   `canvasStore.isReadOnly` mirrors it (L154-161), so `readOnly` may narrow
   `canSelectNodes` but never changes what is projected onto `selectOnly` or
   `show_info`. The module has no Vue or store imports
   (`docs/guidance/state-and-effects.md` §2: a transition is a pure function
   in its own module).

3. **Vue surfaces read the policy through `useCanvasInteractions`.** It keeps
   `shouldHandleNodePointerEvents` (`canSelectNodes`) for selection paths and
   adds `canEditNodes` for mutation paths: `NodeWidgets.vue` pointer gating
   plus `:inert="!canFocusWidgets"` so Tab or an already-focused textarea
   cannot type while picking (`inert` stays off under plain read-only: the
   app builder's select step sets `read_only` and its `AppInput.vue`
   promotion overlay must keep receiving clicks under the
   `pointer-events-none` grid); `NodeHeader.vue` title double-click; `LGraphNode.vue`
   `handleResizePointerDown` (L472) and `handleContextMenu` (L435-444), which
   returns before `handleNodeRightClick` and `showNodeOptions`;
   `useNodeEventHandlers.ts` collapse (L70), title (L87) and right-click
   (L106); `useSlotLinkInteraction.ts` `onPointerDown`, `onClick`,
   `onDoubleClick`, `finishInteraction` (cleanup only) and
   `handlePointerMove` (L462); `DomWidgets.vue` L119 `readonly`. The
   derivation lives in the composable, not `canvasStore`:
   `agentNodeSelectionStore.ts` L7 already imports `canvasStore` (the reverse
   import is a module cycle),
   and a store whose only content is a `computed` over two other stores is a
   derivation, not state.
4. **One outward projection onto litegraph.**
   `src/renderer/core/canvas/interaction/useCanvasPickingPolicySync.ts`,
   instantiated once from `GraphCanvas.vue` next to `useLitegraphSettings()`
   (L491), takes over the `Comfy.Graph.CanvasInfo` watch from
   `useLitegraphSettings.ts` L19-31 so `canvas.show_info` keeps one writer.
   Its explicit sources are the setting, `canvasStore.canvas` and `isActive`;
   it writes `canvas.selectOnly = picking` and
   `canvas.show_info = canvasInfoEnabled && !picking`, then one
   `draw(false, true)`. It uses
   `flush: 'sync'`: today's writes in `AgentPanelRoot.vue` L960-962 are
   synchronous and the store's chrome watch is created synchronously, so a
   click or key in the same task as `enter()` already sees `selectOnly`. The
   write site carries a one-line doc comment stating that `selectOnly` is a
   projection of `agentNodeSelectionStore.isActive`. `allow_dragnodes` and
   `multi_select` are not projected: `selectOnly` already forces accumulation
   (L4556) and blocks node drag (L2755, L3616), and writing them would
   overwrite extension-set values. `AgentPanelRoot.vue` L874-877, L893-909
   and L958-962 shrink to `store.enter()` and `store.exit()`; the
   save/restore slots and the branch's `restoreShowInfo` are deleted. Exit
   has nothing to restore on the canvas: the policy is recomputed from the
   current setting, so a mid-mode `Comfy.ToggleCanvasInfo` is honoured.
5. **Guards at each mutation site.** Guards read the store or the policy;
   `isSelectOnly()` remains for existing call sites and is equivalent once
   `selectOnly` is a pure projection of `isActive`. Every graph-mutating
   command in `useCoreCommands.ts` returns early while picking: the four
   `Comfy.Canvas.ToggleSelectedNodes` commands (`Mute`, `Bypass`, `Pin`,
   `Collapse`), `Comfy.Canvas.ToggleSelected.Pin`, `Comfy.Canvas.Resize`,
   the four `Comfy.Canvas.MoveSelectedNodes` commands,
   `Comfy.Canvas.PasteFromClipboard[WithConnect]`,
   `Comfy.Graph.GroupSelectedNodes`, `Comfy.Graph.ConvertToSubgraph`,
   `Comfy.Graph.UnpackSubgraph`, `Comfy.Graph.FitGroupToContents`,
   `Comfy.Undo`, `Comfy.Redo` and `Comfy.ClearWorkflow`
   (`DeleteSelectedItems` already does). The two non-command keyboard paths
   get the same guard: the `usePaste.ts` handler returns, and
   `ChangeTracker.undoRedo` returns `true` so the event is consumed. Classic
   alt-click clone adds `!this.selectOnly` to its condition (`LGraphCanvas.ts`
   L2461-2467), a condition edit, not a new member. A `mutatesGraph` flag on
   `ComfyCommand`, checked once in the command store, is deferred (below).
6. **Chrome keeps reading the store.** Action bars, sidebar, splitter panels,
   selection toolbox, toasts, banner and the queue and error overlays in
   `TopMenuSection.vue` keep gating on `isActive` or `isActionBarsHidden`.
   They are presentation, not canvas interaction.

### Compatibility requirements

- `canvas.selectOnly`, `canvas.read_only`, `canvas.allow_dragnodes` and
  `canvas.multi_select` keep their types, defaults and meaning. No member is
  added to `LGraphCanvas`, `LGraphNode`, `LGraph` or `Subgraph`. Entity
  callbacks and `node.widgets` access are untouched.
- Classic picking is unchanged except that alt-click no longer clones; the
  existing `LGraphCanvas.selectOnly.test.ts` cases pass unedited and gain one
  row.
- `ADR-CANVAS-SELECTION-0028`'s compatibility clause (L113-114) still holds:
  picker mode keeps node-only accumulation, empty-canvas preservation and its
  edit and drag guards through `canvas.selectOnly`, now a projection rather
  than a second source. Its deferred item at L145 stays with 0029.
- Vue node DOM structure and `data-*` attributes used by e2e tests do not
  change. `shouldHandleNodePointerEvents` keeps its name and meaning.

### Deferred decisions

- `mutatesGraph` command metadata replacing per-site guards.
- Whether the minimap follows the same derivation or keeps flipping the
  user's setting.
- `Comfy.Graph.ToggleWidgetPromotion` (`useCoreCommands.ts` L1091): its only
  first-party trigger is the widget context menu, which picking blocks at
  the menu entry (L2337 classic, `canOpenMenus` Vue); the command guard
  waits for `mutatesGraph`.
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
  the second source across about ten files. `litegraphUtil.ts` L139-142
  already documents that every new edit path must opt in, which is exactly
  how the Vue and DOM widget paths were missed.
- **B with mode ordering (earlier draft).** `readOnly` won and produced a
  `pan` mode from which `selectOnly` was derived. Both reviews found that a
  space-bar press mid-pick then wrote `selectOnly = false` and disabled every
  `isSelectOnly()` guard for the duration of the hold. The orthogonal table
  above replaces it.
- **C: pin `read_only` with picking carve-outs.** Every surface honours
  `read_only`, but selection needs exceptions at `_processPrimaryButton`
  L2453, `LGraphNode.vue` L24-28, `NodeWidgets.vue` L11-15 and the Vue
  select paths; space-bar pan and drag-zoom save and restore `read_only` and
  would fight the pin, which is why `appModeStore` L251-261 installs a re-pin
  watcher, the effect-writes-what-effect-reads loop
  `docs/guidance/state-and-effects.md` §5 warns against, and it conflicts
  with 0029 decision 6.
- **D: a `pick` app mode in `appModeStore`.** Reuses `enforceReadOnly` and so
  inherits C's selection failure; `autoEnableVueNodes` (L263-272) would flip
  a classic user's renderer setting on opening the picker; app modes are
  persisted layout state while picking is a transient gesture.

## Consequences

### Positive

- One fact, one pure derivation, one projection. Exit has nothing to restore
  on the canvas (the sidebar tab and minimap slots remain in the store) and a
  mid-mode setting change is respected.
- Widgets (Vue, DOM, canvas-drawn), titles, collapse, resize, link drags,
  slot disconnects, context menus, paste, undo and the mutation commands are
  blocked while picking in both renderers; click-to-select, space-bar pan,
  zoom and lock behave as they do today.
- The policy is table-testable without a canvas or DOM, and the enumerated
  guard list is finite and reviewable.

### Negative

- Guards remain per-site until command metadata exists; a new mutating
  command or keyboard path must opt in.
- An extension that sets `canvas.selectOnly` itself is overwritten while
  picking and left `false` on exit. No first-party writer outside
  `AgentPanelRoot.vue` exists; the extension corpus has not been scanned.
- The `show_info` settings write moves from the platform layer into a
  renderer composable, so two composables now sync settings onto litegraph.

## Notes

Tracking: [PM-1329](https://linear.app/comfyorg/issue/PM-1329), child of
[PM-995](https://linear.app/comfyorg/issue/PM-995). Implementation:
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
