# ADR-CANVAS-GESTURE-0029: Pointer Gesture State Machine

Date: 2026-09-06

## Status

Proposed

## Context

[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md)
gave selection one owner but deliberately left the input paths that write it
unchanged. Those paths decide what a pointer press means, and they do so in
several places with different rules.

`CanvasPointer` (512 lines) turns raw pointer events into `onClick`,
`onDoubleClick`, `onDragStart`, `onDrag`, `onDragEnd`, and `finally`
callbacks. Every `pointerdown` handler in `LGraphCanvas` assigns some subset of
those callbacks for the hit target it found: `pointer.onClick =` appears 15
times and `pointer.finally =` 10 times. The `finally` setter chains the
previous `finally` before replacing it, so a widget or subgraph IO handler can
extend a callback installed by an earlier branch without either branch naming
the other. The meaning of a press is therefore spread across roughly 40
hit-target branches in `processMouseDown`, `_processPrimaryButton`,
`_setupNodeSelectionDrag`, `_processNodeClick`, and `_processMiddleButton`, and
across five moments in the gesture: press time (sticky selection for right and
double click), `onClick`, `onDragStart` (`_startDraggingItems`), `onDragEnd`
(marquee), and ghost placement.

A press is promoted to a drag when the pointer moves more than
`CanvasPointer.maxClickDrift` (6 px), or when more than
`CanvasPointer.bufferTime` (32 ms) has elapsed. The time rule runs inside
`move()`, so any `pointermove` that arrives after 32 ms, even one pixel of
touchpad jitter, turns a slow click into a drag that selects and moves
nothing, while a fast drag of a few pixels stays a click. Both limits are
exposed as experimental settings (`Comfy.Pointer.ClickDrift`,
`Comfy.Pointer.ClickBufferTime`), so behavior depends on user configuration.

Gesture progress is recorded in mutable canvas flags: `dragging_canvas`,
`dragging_rectangle`, `resizingGroup`, `resizing_node`, `node_widget`,
`isDragging`, `selected_group`, `last_mouse_dragging`, `block_click`,
`_dragZoomStart`, and `read_only`. Space-bar panning and drag-zoom write
`read_only = true` and restore it to `false` unconditionally, so a canvas that
was read-only before the gesture becomes editable afterwards. `processMouseUp`
inspects these flags to decide whether the release was a click or a drag end.

Vue nodes do not use `CanvasPointer`. `useNodePointerInteractions` (193 lines)
starts a layout drag on `pointerdown`, uses `useClickDragGuard(3)` as a
distance threshold, and on the first `pointermove` past the threshold calls
`handleNodeSelect` and a second `startDrag`. `useNodeEventHandlers` (168
lines) reimplements the click policy as `handleNodeSelect`,
`toggleNodeSelectionAfterPointerUp`, and `handleNodeRightClick`. It treats
shift, ctrl, and meta as one "multi-select" modifier and calls
`bringNodeToFront` itself. `_processNodeClick` returns early when Vue nodes
are enabled, so the two renderers hold two click policies that have already
diverged in threshold, modifier meaning, drag start timing, and callback
emission.

The result is a class of bugs that cannot be fixed locally: a fix in one
renderer does not apply to the other, a fix in one `pointerdown` branch does
not apply to the other 39, and a fix in the click path can be undone by the
timing rule. Existing unit tests cover parts of each renderer in isolation:
`useClickDragGuard.test.ts` covers the Vue distance threshold and
`useNodeEventHandlers.test.ts` covers the Vue click and pointer-up selection
policy. `CanvasPointer` has no unit test, and no test drives a real
`LGraphCanvas` through press, move, and release to record which selection
writes and callbacks fire for each target kind. That integration behavior is
what the bugs above live in.

## Decision

Pointer input becomes a single explicit state machine. One pure reducer owns
the interpretation of a gesture, and both renderers feed it.

1. **One reducer.** A pure function
   `reduceGesture(state, event, policy) → { state, effects }` owns the
   gesture lifecycle. `GestureState` is a discriminated union of `idle`,
   `pressed`, and `dragging`. `pressed` and `dragging` hold the press origin,
   the `PointerTarget` captured at `down`, the button and modifiers, and (for
   `dragging`) the drag kind. `idle` may hold the previous click (timestamp,
   position, target key) so the reducer can recognize a double click.
   `GestureEvent` is `down | move | up | cancel`. Every event carries pointer
   position, modifiers, and the event timestamp; only `down` carries a
   `PointerTarget` and a button. `move` and `up` may carry a hover or drop
   target that the adapter resolved for link and reroute drags; the press
   target itself never changes after `down`. The reducer never touches a
   store, the DOM, a canvas instance, or the clock.

   Transitions:

   - `idle` + `down` → `pressed`. Emits press-time effects such as
     `bringToFront` and sticky selection for the right button.
   - `pressed` + `move` beyond the drift threshold → `dragging`. Emits
     `startDrag` with the drag kind derived from the target and policy.
   - `pressed` + `up` → `idle`. Emits `doubleClick` when the previous click
     in `idle` had the same target key, happened less than
     `CanvasPointer.doubleClickTime` ago, and lies within three times the
     drift threshold; otherwise emits `click`. `idle` records this click
     after a `click` and clears it after a `doubleClick`, matching the
     current `_completeClick` rule.
   - `dragging` + `move` → `dragging`. Emits `moveDrag`.
   - `dragging` + `up` → `idle`. Emits `endDrag` with the release position
     and any drop target.
   - `pressed` + `cancel` → `idle`. Emits no click and no drag effect.
   - `dragging` + `cancel` → `idle`. Emits `cancelDrag`, which the
     interpreter uses to release the drag, restore canvas flags, and release
     pointer capture. Cancellation also clears the previous-click record.
   - Any other pair returns the state unchanged with no effects.

2. **Effects are the only side channel.** The reducer returns a list of plain
   effect values such as `select`, `startDrag`, `moveDrag`, `endDrag`,
   `openContextMenu`, `bringToFront`, and `marquee`. An interpreter applies
   them to `selectionStore`, `layoutStore`, and canvas services. Nothing else
   writes selection or drag state during a gesture. Existing node hooks and
   extension callbacks are emitted by the interpreter in the same order as
   today.
3. **Hit-test once per press.** The `down` event carries a `PointerTarget`
   union (`canvas`, `node`, `nodeTitle`, `widget`, `slot`, `group`,
   `groupTitle`, `reroute`, `link`, `linkCenter`, `resizeHandle`, and
   `subgraphIO`). The classic canvas resolves it with the existing hit-test
   helpers; Vue nodes resolve it from the DOM element that received the event.
   Both adapters keep that target for the rest of the press. No branch
   re-derives what was hit on `move` or `up`.
4. **Distance-only drag threshold.** A press becomes a drag only when the
   pointer moves further than `Comfy.Pointer.ClickDrift`. The time-based
   promotion and `CanvasPointer.bufferTime` are removed, and
   `Comfy.Pointer.ClickBufferTime` is marked `deprecated`. Double click keeps
   its time window and its wider drift allowance.
5. **Modifier semantics are unchanged in this ADR.** Shift and ctrl/meta both
   toggle membership, as `processSelect` does today. Vue nodes adopt this rule
   by routing through the same reducer instead of `handleNodeSelect`. Any
   change to what a modifier means is a separate decision.
6. **`InteractionPolicy` replaces mode flags.** The reducer receives an
   immutable policy value describing what the canvas currently allows:
   whether items may be selected, dragged, or resized, whether the canvas may
   pan, and which button opens menus. `read_only`, `allow_dragcanvas`,
   `selectOnly`, `multi_select`, and `leftMouseClickBehavior` become derived
   from or replaced by that value. Space-bar panning and drag-zoom are gesture
   overrides in the policy for the duration of the press; they do not write
   `read_only`.
7. **`bringToFront` is an effect of pressing a node.** It is emitted on
   `down` for unpinned nodes, as the classic canvas does today, so both
   renderers order nodes the same way.

## Compatibility requirements

- Every effect that maps to an existing node or canvas callback
  (`onSelected`, `onDeselected`, `onNodeSelected`, `onNodeDeselected`,
  `onMouseDown`, `onMouseUp`, `onDblClick`, `onNodeMoved`, `onShowNodePanel`,
  widget `mouse`/`onPointerDown`, `onSelectionChange`) fires with the same
  arguments and in the same relative order as the current implementation.
  Characterization tests capture that order before the reducer replaces a
  path.
- `CanvasPointer` remains exported with its current callback surface until
  the corpus check shows no extension assigns any of `pointer.onClick`,
  `pointer.onDoubleClick`, `pointer.onDragStart`, `pointer.onDrag`,
  `pointer.onDragEnd`, or `pointer.finally`. First-party code assigns all six
  today, in `LGraphCanvas`, `SubgraphInputNode`, `SubgraphOutputNode`,
  `WidgetLegacy.vue`, and `useImagePreviewWidget`. During migration
  `CanvasPointer` is a thin adapter that dispatches `GestureEvent` values and
  runs assigned callbacks as effects.
- `canvas.read_only`, `canvas.allow_dragcanvas`, and `canvas.multi_select`
  remain readable and writable; writes update the policy, and reads derive
  from it.
- `Comfy.Pointer.ClickBufferTime` stays registered as a deprecated setting so
  stored user settings do not fail validation. Its value has no effect.
- Vue node DOM structure and `data-*` attributes used by e2e tests do not
  change.

## Deferred decisions

- Named modifier semantics (for example, shift adds and ctrl toggles) and
  parity with common graph editors.
- Whether group selection continues to cascade to children on press or
  becomes group-ID-only with derived child behavior.
- Touch and pen gestures (long press, pinch) as first-class events in the
  reducer.
- Removing `CanvasPointer` callbacks from the public surface.
- Keyboard-driven selection (arrow navigation, tab order) as reducer input.

## Alternatives considered

- **Fix each `pointerdown` branch in place.** Keeps the current shape and
  requires no new module, but leaves 40 branches and two renderers that can
  drift again. The bugs this ADR targets are cross-branch inconsistencies, so
  local fixes do not remove the class.
- **Make Vue nodes call `CanvasPointer`.** Unifies the two renderers on the
  existing callback design. It would inherit the time-based promotion and the
  per-branch callback assignment, and DOM events would still need a target
  translation, so it removes the renderer split without removing the branch
  split.
- **Adopt a gesture library.** Libraries such as `@use-gesture` classify
  pointer motion but do not know canvas targets or selection policy; the
  branch logic would remain. The reducer is small and its tests are the value.
- **Keep the time-based click buffer.** Its code comment says it covers a
  user who holds the pointer still and then releases, but promotion only runs
  inside `move()`, so a press with no `pointermove` never becomes a drag. In
  practice the rule only converts slow, jittery clicks into drags, which is
  the "click became drag" class of reports. Distance-only thresholds match
  tldraw, Excalidraw, React Flow, and most desktop toolkits.
- **Replace all input handling in one change.** Shortest transition, but the
  compatibility requirements above cannot be verified for 40 branches at once.
  A reducer that adopts one target kind at a time can be reviewed against the
  characterization tests for that kind.

## Consequences

### Positive

- The meaning of a press is defined in one pure function that can be tested
  without a canvas, a DOM, or timers.
- Classic and Vue renderers share a policy, so a fix applies to both.
- Click versus drag no longer depends on wall-clock time or on host load.
- Canvas mode flags become one immutable value instead of a dozen
  independently mutated fields; read-only state cannot be lost by a space-bar
  press.
- Selection writes during gestures go through the same commands as every
  other selection change, satisfying ADR-CRDT-LAYOUT-0003 and ADR-ECS-0008.

### Negative

- `CanvasPointer` and the new reducer coexist for several PRs; both must be
  understood to review a gesture change.
- Users who tuned `Comfy.Pointer.ClickBufferTime` lose that knob.
- Extensions that read canvas flags such as `dragging_canvas` mid-gesture
  rely on adapters until the deferred callback decision removes them.
- Characterization tests fix callback order that may later be intentionally
  changed.

## Notes

After the migration is complete, revise this ADR to remove implementation
history that the code makes clear. Keep the approaches we rejected or moved
away from and the reasons why.

Tracking: [FE-2040](https://linear.app/comfyorg/issue/FE-2040).

Related decisions:
[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md)
owns selection state and lists the interaction decisions deferred to this ADR;
[ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
requires command-shaped mutations;
[ADR-ECS-0008](ECS-0008-entity-component-system.md) requires behavior in
systems rather than entity methods; and
[ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)
classifies selection as session state.

Planned migration order:

1. Add gesture characterization tests that drive a real `LGraphCanvas` and
   `CanvasPointer` and record selection, drag, and callback order per target
   kind.
2. Extract `reduceGesture` with `CanvasPointer` as its adapter; remove the
   time-based promotion and deprecate the setting.
3. Route Vue node pointer events through the reducer; delete
   `handleNodeSelect`, `toggleNodeSelectionAfterPointerUp`, and the Vue
   drag-guard state.
4. Replace `pointer.onClick` writers in `LGraphCanvas` one target kind at a
   time with `PointerTarget` resolution and effects.
5. Introduce `InteractionPolicy` and derive the legacy mode flags from it.
