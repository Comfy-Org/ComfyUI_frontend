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
`agentNodeSelectionStore.enter()`. "Picking is on" had two writers
(`isActive` and `selectOnly`) and no derivation between them.

`selectOnly` was only read by the classic canvas. Vue-rendered nodes, the
default on cloud and desktop, gated pointer handling on
`shouldHandleNodePointerEvents`, which was `!canvasStore.isReadOnly`
(`useCanvasInteractions`); nothing under `src/renderer/extensions/vueNodes`
read `selectOnly`. During picking a user could still type into a Vue text
widget, rename a node from its header, collapse it, resize it, drag a link
from a slot, Ctrl+Alt-click a slot to disconnect it and right-click it for
the options menu; classic DOM widgets read `read_only` and stayed editable
too. Keyboard paths were a third gap: `Comfy.Canvas.DeleteSelectedItems`
checked `selectOnly` but the bypass, mute, pin, collapse, resize, nudge,
paste, group and subgraph commands did not; Ctrl+Z ran through
`changeTracker.ts` and plain Ctrl+V through `usePaste.ts`, neither via the
command store. The picker leaves nodes selected, so Ctrl+B during picking
bypassed the picked nodes.

An intermediate revision of this PR pinned `canvas.read_only`, which closed
those gaps and broke the one interaction the mode needs: every press became
a pan and Vue nodes went `pointer-events-none`, so click-to-select died.

A later revision projected `isActive` outward: a pure `resolvePickingPolicy`
truth table, a per-canvas `selectOnly` pin that installed an own accessor on
the canvas instance and tracked owner symbols, a `useCanvasPickingPolicySync`
composable that wrote the pin, `canvas.show_info` and a
`commandPolicyStore.graphMutationsLocked` flag, and `canEditNodes` /
`canFocusWidgets` capabilities read by about twenty surfaces: the node
header's collapse button and title editor, the node body's resize handles,
context menu, alt-clone, advanced toggle and drop handlers, the widget grid,
the slot link interaction, the node event handlers, the DOM widget layer and
the media preview. Review found that this spread one policy across every
surface: each new surface had to know the capability to read, the pin
depended on `Object.defineProperty` against the canvas instance, and the
lock and pin owner sets released on different events, which produced two
rounds of ownership fixes.

[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md)
requires picker mode to keep "its current edit and drag guards through
`canvas.selectOnly`" and defers replacing `selectOnly` with an interaction
policy to
[ADR-CANVAS-GESTURE-0029](CANVAS-GESTURE-0029-pointer-gesture-state-machine.md),
whose decision 6 names an `InteractionPolicy`. This ADR is a narrow step
toward that value and leaves the name to 0029.

## Decision

Picking is one interaction mode, read where input is dispatched. Nothing
copies it anywhere.

1. **One authoritative fact.** `agentNodeSelectionStore.isActive` is the only
   stored representation of "picking is on". It already owns entry, exit,
   Escape and the workflow, target and graph-change exits.
   `AgentPanelRoot.vue` calls `store.enter()` and `store.exit()` and holds no
   canvas save/restore state of its own. Graph replacement is a projection
   boundary: `LGraphCanvas.setGraph()` releases the outgoing items from the
   canvas before it attaches the new graph, dispatches `litegraph:set-graph`
   once, and drops the outgoing graph's selection-store scope only after the
   listeners have run; the panel exits picking synchronously when
   `canvasStore.currentGraph` changes, so every staged reference, including
   one to a node of another graph scope, survives the switch.

2. **One reader, injected into litegraph.**
   `CanvasInteractionModeReader` (`src/lib/litegraph/src/canvas/CanvasInteractionMode.ts`)
   is a one-method interface, `isSelectOnly(): boolean`. The application
   implements it over the store in
   `src/renderer/core/canvas/interaction/canvasInteractionMode.ts` and
   `ComfyApp` hands the same instance to the canvas constructor
   (`options.interactionMode`) and to `commandStore.setInteractionMode()`
   when it creates the canvas. litegraph never imports an application store;
   a canvas constructed without a reader behaves as before, and the reader
   survives `setGraph()` because it belongs to the canvas, not the graph.
   `canvas.selectOnly` reads `state.selectOnly || interactionMode.isSelectOnly()`,
   so the canvas's own flag keeps its meaning for extensions and every
   existing reader of `selectOnly`, including `isSelectOnly()` in
   `litegraphUtil.ts`, sees the mode without a pin or a projection.

3. **Three primary integration boundaries read the mode.**

   - **Canvas pointer and key dispatch.** `_processPrimaryButton` classifies
     the press once: while select-only it runs
     `#processSelectOnlyPrimaryButton`, where a press on a node registers
     only `processSelect(node)` and any other press is an empty-canvas press
     (pan or selection rectangle through `#setupCanvasDrag`). The editable
     branch, with its alt-clone, widget, collapse, slot, resize, subgraph
     IO, reroute, link, badge, group and double-click handling, is never
     entered, so those paths carry no select-only checks of their own.
     Middle and secondary buttons keep their existing early `selectOnly`
     read, and `processKey` skips the selected-node `onKeyDown`/`onKeyUp`
     dispatch while keeping its Space and Escape handling.
     `processSelect()` and `select()` keep the select-only selection
     semantics (node-only, accumulating, empty-canvas preservation) required
     by 0028; those are selection behaviour, not gating.
   - **`commandStore.execute`.** Graph-mutating core commands declare
     `mutatesGraph` on `ComfyCommand`, either `true` or a predicate evaluated
     at dispatch, and `execute` refuses such a command while the injected
     reader is select-only, synchronously, so menus, keybindings and the
     selection toolbox share one check and the decision, the predicate and
     the command body run in the dispatching task. `Comfy.Undo` and
     `Comfy.Redo` declare `!dialogStore.isDialogOpen('global-mask-editor')`,
     so the mask editor's own history keeps working during picking.
     `useCoreCommands.selectOnly.test.ts` pins the declared set so a change
     to it is visible in review; the classification is hand-maintained, and
     a command without the capability, which today means every extension
     command, is not gated.
   - **The DOM layers above the canvas.** `GraphCanvas.vue` renders the Vue
     node layer (`TransformPane`) and `DomWidgets.vue` renders the classic
     DOM widget layer with `:inert="agentNodeSelectionStore.isActive"`. An
     inert subtree is not a pointer target and its descendants cannot take
     or keep focus, so while picking every press and wheel reaches the
     canvas underneath, which classifies it as above, and no widget, header
     button, resize handle, slot or media preview needs a pointer binding of
     its own. `inert` promises nothing about where keyboard events go;
     keyboard safety comes from `processKey`, `commandStore.execute` and the
     document-level guards below, with no focused widget left to receive
     the keys. The Vue node pointer interactions therefore no longer read
     the store either.

   **Document-level guards outside the three boundaries.** Input that
   bypasses the canvas and the command store is guarded at its own entry
   point with `isSelectOnly(canvas)` (`litegraphUtil.ts`), which reads
   `canvas.selectOnly` and so the injected mode:

   - the `paste` listener in `usePaste.ts`;
   - the `ChangeTracker` `keydown` listener, which snapshots the mode at
     keypress before deferring to the animation frame, so `undoRedo` decides
     with the value the user pressed under;
   - the `drop` listener in `app.ts` (file drops) and the `onDrop` handler in
     `useCanvasDrop.ts` (tree-explorer and model drops);
   - `useSelectionOperations.deleteSelection`, reached from the selection
     menu options rather than through a command;
   - `litegraphUtil.createNode`, the node-creating step of the paste and
     file-drop paths.

   These are the `isSelectOnly()` call sites outside the boundaries. A new
   edit path that reaches the graph without passing a boundary has to join
   this list.

4. **Chrome reads the store.** Action bars, sidebar, splitter panels,
   selection toolbox, toasts, banner, the queue and error overlays in
   `TopMenuSection.vue` and the canvas info overlay are presentation, not
   canvas interaction. `useLitegraphSettings` derives
   `canvas.show_info = canvasInfoEnabled && !picking` from the setting and
   `isActive`, so a mid-mode `Comfy.ToggleCanvasInfo` is honoured on exit
   with nothing to restore by hand. Chrome that owns listeners is hidden,
   not unmounted: `QueueNotificationBannerHost` stays mounted with a `hidden`
   class, because its `useQueueNotificationBanners` removes the
   `promptQueueing`/`promptQueued` listeners on unmount and a run queued
   during picking would lose its banner.

### Compatibility requirements

- `canvas.selectOnly`, `canvas.read_only`, `canvas.allow_dragnodes` and
  `canvas.multi_select` keep their types, defaults and meaning. Writing
  `canvas.selectOnly` still sets the canvas's own flag; while the injected
  mode is select-only the getter reads `true` regardless of that flag.
  `LGraphCanvas` gains one constructor option and no method. `LGraphNode`,
  `LGraph` and `Subgraph` are untouched; entity callbacks and `node.widgets`
  access are untouched.
- Classic picking keeps node selection, empty-canvas preservation, panning
  and the selection rectangle; alt-click clone, widget edits, collapse,
  slot and reroute link drags, link menus, group resize and title-bar
  drags, click-to-front reordering, selected-node key callbacks and the
  group, badge and empty-canvas double-click actions are suppressed. The
  `LGraphCanvas.selectOnly.test.ts` assertions exercise these through
  `_processPrimaryButton`, and `LGraphCanvas.interactionMode.test.ts`
  covers the reader: absent, editable, select-only, read at interaction
  time, and kept across `setGraph()`.
- `ADR-CANVAS-SELECTION-0028`'s compatibility clause still holds: picker
  mode keeps node-only accumulation, empty-canvas preservation and its edit
  and drag guards through `canvas.selectOnly`, now derived from the injected
  mode rather than written by a second source. Its deferred
  `InteractionPolicy` item stays with 0029.
- Vue node DOM structure and `data-*` attributes used by e2e tests do not
  change; the Vue node layer and the DOM widget layer gain an `inert`
  attribute while picking, and the DOM widget layer gains
  `data-testid="dom-widgets"`. While the layer is inert an e2e test reaches
  a node by clicking its coordinates, since the pointer target is the canvas.
- `litegraph:set-graph` keeps its detail and fires exactly once per graph
  replacement, from `setGraph()` with the new graph attached and the canvas
  selection already empty; `openSubgraph()` delegates to it and
  `canvas.subgraph` is a plain field that emits nothing.

### Deferred decisions

- Whether extension commands should declare `mutatesGraph`, and whether
  the capability should also gate `read_only`.
- Whether the minimap follows the same derivation or keeps flipping the
  user's setting.
- Whether picking should lock `GraphCanvasMenu`'s lock button, which can flip
  `read_only` mid-mode and turn every click into a pan.
- Hover feedback on Vue nodes while the layer is inert, if the picking
  banner turns out not to be enough of a cue.

## Alternatives considered

- **A: a projection layer and per-surface guards (the previous revision of
  this PR).** `resolvePickingPolicy({ readOnly, picking })` derived
  `canSelectNodes`, `canEditNodes` and `canFocusWidgets`; a
  `useCanvasPickingPolicySync` composable pinned `canvas.selectOnly` through
  a per-canvas owner registry that installed an own accessor on the canvas
  instance, wrote `canvas.show_info` and `commandPolicyStore.graphMutationsLocked`;
  `useCanvasInteractions` exposed the capabilities to Vue; and about twenty
  surfaces each bound `:disabled`, `:inert`, `pointer-events-none` or an
  early return to one of them. The reviewer's objection: the policy was
  enforced at every surface instead of where input is dispatched, so the set
  of guards was open-ended (each new surface had to opt in, exactly how the
  Vue and DOM widget paths were missed in the first place), the pin was a
  runtime patch of a class accessor, and the two owner sets (pin and lock)
  released on different events and needed their own tests to stay aligned.
  The chokepoint design keeps the one derivation that mattered (the store is
  the fact) and replaces every projection with a read.
- **B: keep `selectOnly` and add per-surface guards without a derivation.**
  Zero API change, but `selectOnly` is a plain class field with no reactive
  mirror, so every Vue surface would read `agentNodeSelectionStore.isActive`
  directly, and the guard set stays open-ended as in A.
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
- **E: the command store imports the agent store.** `agentNodeSelectionStore`
  imports `canvasStore`, which pulls `useAppMode`, `appModeStore` and the
  `ComfyApp` instance into every module that imports the command store; an
  earlier revision broke unrelated suites that mock the api or distribution
  flags partially, and a dynamic import moved the decision past an `await`,
  which let the mode change before the command body ran. Injecting the same
  reader the canvas receives keeps the command store's module graph and
  makes the decision synchronous.

## Consequences

### Positive

- One fact, one reader, three primary boundaries and a short, closed list
  of document-level guards. No canvas property is pinned, no flag is copied
  into a second store, and no owner set has to be released.
- Widgets (Vue, DOM, canvas-drawn), titles, collapse, resize, link drags,
  slot disconnects, context menus, paste, undo and the mutation commands are
  blocked while picking in both renderers; click-to-select, space-bar pan,
  zoom and lock behave as they do today.
- Adding a surface above the canvas needs no guard as long as it lives under
  the inert layers; adding a classic pointer path needs no guard as long as
  it lives in the editable branch of `_processPrimaryButton`.
- litegraph stays free of application imports; the interface is the only
  coupling and the application chooses what "select-only" means.

### Negative

- A new mutating core command declares `mutatesGraph` and nothing checks
  that it does; the document-level guards under decision 3 are
  hand-maintained call sites, so a new edit path that bypasses the three
  boundaries must still opt in.
- The Vue node layer receives no pointer events while picking, so nodes
  show no hover feedback and Vue-side selection code does not run; the
  canvas selects through `processSelect()` with select-only semantics, which
  accumulates on plain click exactly as the classic canvas does.
- `commandStore.setInteractionMode()` is a second injection point for the
  same reader, kept because the command store cannot import the agent or
  canvas stores (alternative E).

## Notes

Implementation:
[PR #18066](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18066).

The sequence number collides with open
[PR #18106](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18106)
(`CRDT-RECONCILE-0035`); other ADR filenames already share a sequence
number, so this is tolerable by precedent. `ADR-CANVAS-GESTURE-0029`
migration step 5 ("Introduce `InteractionPolicy` and derive the legacy mode
flags from it") should start from `CanvasInteractionModeReader` for the pick
case; 0029 is not edited in this PR.

Related decisions:
[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md)
owns selection state and requires picker guards through `canvas.selectOnly`;
[ADR-CANVAS-GESTURE-0029](CANVAS-GESTURE-0029-pointer-gesture-state-machine.md)
owns the full `InteractionPolicy`; and
[ADR-ECS-0008](ECS-0008-entity-component-system.md) places behaviour in
systems and composables rather than entity methods.
