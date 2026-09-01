# 0027. Keybinding Dispatch and Dialog Scopes

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
any dialog was open.

The original design document proposed adopting VS Code's model wholesale:
reactive context keys, a `when`-clause grammar on bindings, and a single
capture-phase dispatcher. An adversarial review of that design against this
repository found that every binding that needs scoping today, and every
scope an extension can realistically want, is "the dialog I opened", and
that the capture flip would break at least seven deliberate local Escape
and Delete handlers. This record adopts the smaller model that covers the
same ground.

## Decision

### D1 — One dispatcher, window bubble phase

`keybindingService.keybindHandler` is the only code that resolves a keydown
against the store. The `processKey` lookup in `app.ts` is deleted;
litegraph's own `processKey` is left untouched and remains the only
canvas-phase keydown consumer (Space-to-pan, Escape cancels a link drag,
`node.onKeyDown` fan-out).

The dispatcher stays on the window in the bubble phase and skips any keydown
whose `defaultPrevented` is already set. A listener on an element, on the
document, or in the capture phase can therefore claim a key with
`preventDefault()` instead of `stopPropagation()`. A bubble-phase window
listener registered after app init cannot claim a key this way; it runs
after the dispatcher.

### D2 — A binding is scoped to a dialog and conditioned on context keys

`Keybinding` gains two optional fields.

- `dialogKey`: the `dialogStore` key of the dialog the binding belongs to. A
  binding without one is a workspace binding, as before. A scoped binding is
  looked up first and fires only while its dialog is the active (top-most)
  one; a workspace binding fires only while no modal is open.
- `when`: a conjunction of context keys, written `key && !otherKey`. The
  grammar is deliberately that small: no disjunction, grouping or comparison,
  so "same clause" is decidable by comparing canonical spellings. An `||` is
  two bindings.

Context keys are boolean and live in `contextKeyStore`. `modalOpen` and
`textInputFocus` are built in and derived on every keydown. Core registers
its own keys; an extension declares `contextKeys` on `registerExtension`,
which registers them as `<extension name>.<key>`, and sets them through
`app.extensionManager.contextKey.set`, which refuses core-owned keys. A
clause naming a key nobody has registered never matches, negated or not, so
a typo cannot enable a binding everywhere; a key registered later starts
working when it appears.

Resolution within one combo and scope: bindings with narrower clauses (more
atoms) are tried first, user bindings before defaults at equal width, then
registration order, and the first whose clause holds runs. Two bindings
conflict only when combo, scope and clause are all identical. So
`w → pan when ext.wasdMode` coexists with the core `w → toggle sidebar` and
shadows it while the mode is on.

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

## Alternatives considered

**`dialogKey` alone.** Shipped first and reviewed. It covered the mask
editor and nothing else: an extension could scope only to a dialog it had
opened, a WASD navigation mode over the already-bound `w`, `a` and `s` keys
was inexpressible, and no binding could opt into a text input. Keeping
`dialogKey` as the exact scope bucket and adding `when` on top costs a small
parser and a key registry, and it is the direction that stays compatible
with persisted data.

**Capture-phase dispatcher.** Determinism by construction, at the cost of
preempting every listener that today keeps a bound key from the dispatcher
on purpose: ghost placement Escape/Delete/Backspace, image-preview Escape,
bounding-box Delete, asset-grid Ctrl+A, tour Escape, legacy popup Escape,
and every Reka `.escape.stop` shield. Each would need a context key or a
rewrite before the flip. The four wins above do not need it.

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

- Version skew is lossy. An older frontend drops `dialogKey`, drops unset
  entries for commands it does not know and for combos that have no default
  there (warning at each of its startups), and re-persists what it kept on
  the next keybinding edit. A stripped binding for a command it lacks becomes
  a live workspace shortcut that throws on that build. A user who customizes
  undo or mask-editor undo and then edits keybindings on an older build
  loses that customization.
- An extension that declared a workspace binding on `Ctrl+Z`, `Ctrl+Y` or
  `Ctrl+Shift+Z` now collides with a core default and is rejected with the
  usual conflict toast, as it would be for any other core combo.
- A DOM-only modal (legacy `.comfy-modal`, a native `<dialog>`, a hand-rolled
  `aria-modal` overlay) raises the modal guard but never becomes the active
  dialog, so a scoped binding under one would still fire. No such surface is
  reachable from inside the mask editor today.
- Escape inside any dismissable layer, including a dialog's own content, is
  never dispatched, so a binding on bare Escape cannot be scoped to a dialog.

## Non-goals

- Hold bindings (Space-to-pan) and arbitrary context keys; `dialogKey`
  covers the scopes in use.
- A component-local `useKeybinding` composable, a dispatch trace mode, a
  context inspector, a versioned settings key, preset-import review, or the
  Edit Keybinding dialog's keyboard accessibility.
- The three text surfaces that stop propagation for every key
  (`WidgetMarkdown`, the markdown widget input, the bounding-box textarea);
  they should stop only unmodified keys, independently of this record.
