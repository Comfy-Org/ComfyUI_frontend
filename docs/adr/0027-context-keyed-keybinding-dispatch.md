# 0027. Context-Keyed Keybinding Dispatch

Date: 2026-09-01

## Status

Proposed

## Context

Keyboard shortcuts are resolved against one store, `keybindingStore`, but
until now two independent dispatchers consulted it with different guards:

- a window-level bubble listener registered by `GraphView.vue`, which
  checked text-input focus, the modal state, and `targetElementId`
  containment, but ignored `event.repeat`, `event.defaultPrevented` and
  `event.isComposing`;
- a capture-phase listener on the canvas element, installed by `app.ts`
  monkey-patching `LGraphCanvas.prototype.processKey`, which executed only
  bindings with `targetElementId: 'graph-canvas-container'`, checked
  neither the modal state nor text-input focus, and called
  `stopImmediatePropagation()` after executing.

Undo and redo were never in the store at all. `Ctrl+Z`, `Ctrl+Y` and
`Ctrl+Shift+Z` were hard-coded in two capture-phase listeners, one in
`changeTracker.ts` for the graph and one in the mask editor's `useKeyboard`,
each with its own idea of when a text input or a modal should block them.
The `Comfy.Undo` and `Comfy.Redo` commands existed but were invisible to the
shortcuts UI and could not be rebound or disabled.

The only way to scope a binding was DOM containment, so the same combo could
never serve both the workspace and a modal such as the mask editor: the store
held one binding per combo, and the modal guard blocked every binding while
any dialog was open. Around the store, an inventory found roughly a hundred
keyboard-handling sites in some sixty-five files: twenty at window or
document level, seven in the capture phase, and a dozen calling
`stopPropagation` specifically to keep a key away from the central system.
Each of the last three modal-guard fixes widened a DOM query to cover a
dialog generation the previous one had missed.

The design document "Frontend Keybinding Architecture" proposes VS Code's
model for this: reactive context keys owned by the code that owns the
state, `when` clauses on bindings, one dispatcher that resolves user
bindings before extension bindings before core defaults, and a dispatcher
in the capture phase so that no listener needs `stopPropagation` to defend
itself. This record adopts that model in full and sequences it. Every phase
lands as its own change; the Rollout section says which phases the code
accompanying this record already covers.

## Decision

### D1 — One dispatcher

`keybindingService.keybindHandler` is the only code that resolves a keydown
against the store. The `processKey` lookup in `app.ts` is deleted.
litegraph's own `processKey` is left untouched for now and remains the only
canvas-phase keydown consumer (Space-to-pan, Escape cancels a link drag,
`node.onKeyDown` fan-out) until phase 6 turns those behaviours into
bindings.

The dispatcher runs on the window. When it executes a command it calls
`preventDefault()`; it never calls `stopPropagation()`, so every listener
after it can see what was claimed. It skips a keydown whose default was
already prevented, so a listener on an element, on the document, or in the
capture phase can claim a key with `preventDefault()` instead of
`stopPropagation()`.

It is registered in the bubble phase today. Phase 4 moves it to the capture
phase, dark behind a hidden setting with a kill switch, once the
preconditions under Rollout hold. Bubble is the rollout position, not the
end state: as long as the dispatcher runs last, the seven capture-phase
listeners in the app and every extension listener still preempt it, and
ordering stays a property of registration order rather than of the
resolver.

### D2 — A binding is scoped to a dialog and conditioned on context keys

`Keybinding` gains two optional fields.

- `dialogKey`: the `dialogStore` key of the dialog the binding belongs to. A
  binding without one is a workspace binding, as before. A scoped binding is
  looked up first and fires only while its dialog is the active (top-most)
  one; a workspace binding fires only while no modal is open.
- `when`: a conjunction of context keys, written `key && !otherKey`. The
  grammar is deliberately that small: no disjunction, grouping or comparison,
  so "same clause" is decidable by comparing canonical spellings and
  conflict detection is exact rather than heuristic. An `||` is two
  bindings. Widening the grammar later is backward compatible with every
  persisted clause; narrowing it would not be, which is why it starts
  narrow.

Context keys are boolean and live in `contextKeyStore`. `modalOpen` and
`textInputFocus` are built in and derived on every keydown. Core registers
its own keys; an extension declares `contextKeys` on `registerExtension`,
which registers them as `<extension name>.<key>`, and sets them through
`app.extensionManager.contextKey.set`, which refuses core-owned keys. A
clause naming a key nobody has registered never matches, negated or not, so
a typo cannot enable a binding everywhere; a key registered later starts
working when it appears. The facade is global across extensions, as VS
Code's `setContext` is: the extension API carries no caller identity, and
extensions already run arbitrary JavaScript, so ownership is enforced at
registration, where it prevents accidental collisions, and not at write
time, where it could only be advisory.

Resolution within one combo and scope: bindings with narrower clauses (more
atoms) are tried first, user bindings before defaults at equal width, then
registration order, and the first whose clause holds runs. Two bindings
conflict only when combo, scope and clause are all identical. So
`w → pan when ext.wasdMode` coexists with the core `w → toggle sidebar` and
shadows it while the mode is on. Phase 2 puts the binding's source ahead of
clause width, so that a user's rebind always beats an extension's or core's
narrower clause; until then a narrower default clause can outrank a broader
user binding on the same combo.

Combos reserved by text inputs stay out of text-editing controls unless the
clause names `textInputFocus`, which is how a binding opts into a textarea.

The store keeps arrays keyed by binding identity (command, combo, target
element, dialog key, clause) and derives the active set. The Edit Keybinding
dialog carries scope and clause forward and reports a conflict only against
an identical binding. Extension keybindings are validated at registration.
`targetElementId` is unchanged and remains a dispatch-time containment check.

### D3 — Guard policy is uniform and explicit

| Guard                    | Window path before                                                                                  | `processKey` path before                                     | Now                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which bindings           | all                                                                                                 | canvas-scoped, then `stopImmediatePropagation`               | all, one path, never stops propagation                                                                                                                                                               |
| `event.defaultPrevented` | ignored                                                                                             | ignored                                                      | skipped                                                                                                                                                                                              |
| `event.isComposing`      | ignored                                                                                             | ignored                                                      | skipped                                                                                                                                                                                              |
| `event.repeat`           | dispatched                                                                                          | skipped, then fell through to the window path and dispatched | dispatched                                                                                                                                                                                           |
| Modal open               | workspace bindings blocked, `preventDefault` if Ctrl                                                | not checked                                                  | unchanged for workspace bindings; bindings scoped to the active dialog run                                                                                                                           |
| Text input focus         | reserved combos blocked on `INPUT`, `TEXTAREA`, `contentEditable === 'true'`, `SPAN.property_value` | dead check                                                   | same set, except `INPUT` types that do not edit text (range, checkbox, radio, button, submit, reset, color, file, image) and inherited `isContentEditable`; a clause naming `textInputFocus` opts in |
| Escape ownership         | `[role="menu"]`                                                                                     | none                                                         | `[role="menu"]` and `[data-dismissable-layer]`                                                                                                                                                       |
| Unknown command          | throws after `preventDefault`                                                                       | throws                                                       | inert, console warning                                                                                                                                                                               |
| `graph.change()`         | none                                                                                                | after the command                                            | litegraph's `processKey` still calls it before the command for canvas-targeted keydowns; every canvas command redraws on its own                                                                     |

Behavior that changes for users as a result:

- Escape while dragging a link cancels the drag without also exiting the
  subgraph. litegraph prevents the default and the dispatcher now honours it.
- Escape in a Vue node image gallery leaves the gallery without also exiting
  the subgraph, for the same reason.
- Escape inside a Reka popover, select, combobox or menu that has no local
  `.stop` shield now dismisses the layer. Reka's dismissable layer listens on
  the window in the bubble phase and defers when `defaultPrevented` is set,
  so the dispatcher's own `preventDefault` used to suppress the dismiss.
- Ctrl+Enter in the agent composer sends the message and no longer also
  queues the workflow.
- Bare-key shortcuts fire while a slider, checkbox or radio button has focus.
  They already did while any non-input element had focus.
- Ctrl+Enter in the batch-count input still queues; its handler now ignores
  the Ctrl and Meta variants instead of preventing every Enter.

### D4 — Undo and redo are bindings

`Ctrl+Z`, `Ctrl+Y` and `Ctrl+Shift+Z` become default bindings on
`Comfy.Undo` and `Comfy.Redo`. The mask editor gets its own
`Comfy.MaskEditor.Undo` and `Comfy.MaskEditor.Redo` commands bound to the
same combos with `dialogKey: 'global-mask-editor'`. Both hard-coded
listeners lose their undo code, and the mask editor content root loses the
`@keydown.stop` shield that kept those keys from reaching the window.

Consequences for users:

- Undo and redo are visible, rebindable and disableable in the shortcuts
  UI, separately for the workspace and the mask editor.
- Holding Ctrl+Z repeats undo, as in every other editor. `changeTracker`
  suppressed repeats only as a side effect of its state-capture guard. A
  graph restore already in flight ignores further undo and redo requests,
  so repeats never interleave with an asynchronous load.
- Ctrl+Z while typing in a mask-editor text or number input performs the
  input's own undo. The old listener ignored focus entirely.
- Ctrl+Z from an input with auto-queue in "change" mode no longer triggers
  graph undo; that exemption belonged to state capture, not to undo.

## Invariants

- A keydown executes at most one binding.
- A scoped binding never fires outside its dialog; a workspace binding
  never fires while a modal is open.
- A combo reserved by text inputs never fires from a text-editing control
  unless its clause names `textInputFocus`.
- A clause naming an unregistered context key never matches.
- The dispatcher calls `preventDefault()` in exactly two cases: when it
  executes a command, and when a Ctrl combo that a workspace binding would
  claim arrives while a modal is open, so the browser does not act on it.
- `dialogStore.activeKey` is the most recently activated dialog that is
  still open. `closeDialog` previously promoted the oldest entry, which made
  a covered dialog "active" at depth three.

## Rollout

Phases are ordered by dependency. Each is its own change.

| Phase | What                                                                                                                                                                                                                | Status                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1     | Context key store, `when` parser, `dialogKey`, extension-registered keys                                                                                                                                            | Done, preceding change       |
| 2     | Store rework: several bindings per combo, a `source` on every binding, resolution by source tier (user, extension, core) before clause width, attributable conflict reporting                                       | Next change                  |
| 3     | One dispatcher with the guard matrix in D3                                                                                                                                                                          | Done, this change            |
| 4     | Capture-phase dispatcher behind a hidden setting with a kill switch; `data-comfy-keybinding-ignore` escape hatch checked via `composedPath()`; `processKey` kept as a deprecated shim for one cycle                 | Pending; preconditions below |
| 5     | Undo and redo as bindings (D4)                                                                                                                                                                                      | Done, following change       |
| 6     | Hold bindings with press and release commands and guaranteed release on blur (Space-to-pan); canvas Escape variants as context-scoped bindings; a `useKeybinding` composable for component-local bindings           | Pending                      |
| —     | Versioned settings key for scoped bindings, with the legacy `NewBindings` key kept as a lossy mirror, so an older frontend cannot strip `when` or `dialogKey` and re-persist the result; preset import shows a diff | Pending                      |
| —     | Dispatch trace mode, context-key inspector, persistent conflict reporting in the shortcuts panel, keyboard accessibility of the Edit Keybinding dialog                                                              | Pending                      |

Preconditions for phase 4. A capture-phase dispatcher runs before every
local handler, so a `preventDefault()` claim no longer reaches it. Each of
the following either raises a context key or carries the escape hatch
before the flip: ghost placement Escape, Delete and Backspace; image-preview
Escape; the bounding-box Delete; the asset-grid Ctrl+A; the tour Escape; the
legacy popup Escape; and every Reka `.escape.stop` shield. Three e2e specs
land first: Escape in a popover inside a subgraph, no double dispatch of a
canvas-scoped binding, and Ctrl+Z in the mask editor. The flip is tested
against rgthree-comfy and ComfyUI-Custom-Scripts, which patch `processKey`
and listen on the window respectively.

## Alternatives considered

**Bubble phase as the end state.** It delivers the guard unification and
the dialog scoping in this change with no ecosystem exposure, and it is
where the code stands today. As an end state it leaves the seven
capture-phase listeners and every extension listener ahead of the
dispatcher, so determinism stays conditional and every new surface keeps
needing a shield. Rejected as the end state; adopted as the rollout position
until the phase 4 preconditions hold.

**`dialogKey` alone.** Shipped first and reviewed. It covered the mask
editor and nothing else: an extension could scope only to a dialog it had
opened, a WASD navigation mode over the already-bound `w`, `a` and `s` keys
was inexpressible, and no binding could opt into a text input. Keeping
`dialogKey` as the exact scope bucket and adding `when` on top costs a small
parser and a key registry, and it is the direction that stays compatible
with persisted data.

**The full VS Code clause grammar.** Disjunction, grouping and comparison
make "do these two clauses overlap" a heuristic, so conflict detection
would degrade to best-effort warnings. Restricting to conjunctions keeps it
exact, and the restriction can be lifted later without touching persisted
data.

**Single `Comfy.Undo` with two bindings.** Avoids new command ids, but the
keybinding panel would list `Ctrl+Z` twice under Undo and the two could not
be rebound separately.

## Consequences

### Positive

- One place decides whether a shortcut fires, with one documented guard set.
- Local handlers claim keys with `preventDefault()`; `stopPropagation()`
  shields are no longer required for correctness.
- Same combo, different dialog, no conflict: extensions can bind inside
  their own dialogs.
- Undo and redo behave like every other shortcut.

### Negative

- Until the versioned settings key lands, version skew is lossy. An older
  frontend drops `dialogKey` and `when`, drops unset entries for commands it
  does not know and for combos that have no default there (warning at each
  of its startups), and re-persists what it kept on the next keybinding
  edit. A stripped binding for a command it lacks becomes a live workspace
  shortcut that throws on that build. A user who customizes undo or
  mask-editor undo and then edits keybindings on an older build loses that
  customization.
- Until phase 2 lands, an extension that declared a workspace binding on
  `Ctrl+Z`, `Ctrl+Y` or `Ctrl+Shift+Z` collides with the new core default
  and is rejected with the usual conflict toast.
- A DOM-only modal (legacy `.comfy-modal`, a native `<dialog>`, a hand-rolled
  `aria-modal` overlay) raises the modal guard but never becomes the active
  dialog, so a scoped binding under one would still fire. No such surface is
  reachable from inside the mask editor today.
- Escape inside any dismissable layer, including a dialog's own content, is
  never dispatched, so a binding on bare Escape cannot be scoped to a dialog.
- The three text surfaces that stop propagation for every key
  (`WidgetMarkdown`, the markdown widget input, the bounding-box textarea)
  should stop only unmodified keys; that is independent of this record.
