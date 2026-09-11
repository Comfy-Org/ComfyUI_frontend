# KEYBINDINGS-0027: Context-Keyed Keybinding Dispatch

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

`keybindingService.keybindHandler` resolves keydowns on `window` in the
capture phase. `GraphView` owns installation and disposal. The hidden
`Comfy.Keybinding.CapturePhase` setting defaults to `true`; setting it to
`false` replaces the listener with a bubble listener without reloading and
releases all held actions. This is a rollback switch, not a second dispatcher.

The dispatcher prevents the default for the winning binding unless its
`preventDefault` option is false. It never stops propagation. Later listeners
can observe `defaultPrevented`; they must check it before performing an action.
Composition and already-claimed events are ignored. `allowRepeat: false`
consumes repeat events without executing the command again. Hold bindings
never repeat their press action.

`LGraphCanvas.processKey` remains callable for extension wrappers. It updates
modifier state and forwards unclaimed events to selected nodes' `onKeyDown`
and `onKeyUp` callbacks. Canvas panning, link/ghost cancellation and built-in
image navigation are registered commands. The shim does not resolve shortcuts
or announce a graph change for every key; commands own their mutations and
redraws.

### D2 — A binding is scoped to a dialog and conditioned on context keys

`dialogKey` and `when` determine where a binding is eligible.

- `dialogKey`: the `dialogStore` key of the dialog the binding belongs to. A
  binding without one is a workspace binding, as before. A scoped binding is
  looked up first and fires only while its dialog is the active (top-most)
  one; a workspace binding is blocked by a modal unless its clause explicitly
  requires `modalOpen`. Local overlays use that opt-in together with their own
  active context and focus condition.
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

Every binding has a source: core, an extension (by name), or the user. The
source is assigned by whoever registers the binding, never declared by the
binding itself, so an extension cannot promote its own bindings.

Resolution within one combo and scope: user bindings first, then extension
bindings, then core; within a tier, narrower clauses (more atoms) before
broader ones; then registration order. The clause is a filter, not a rank
across tiers: a user's rebind beats an extension's or core's narrower
clause, and the first candidate in that order whose clause holds runs. Two
bindings conflict only when combo, scope, clause and tier are all
identical. So `w → pan when ext.wasdMode` coexists with the core
`w → toggle sidebar` and shadows it while the mode is on, and an extension
binding on `Ctrl+Z` coexists with the core undo binding and shadows it
until the user rebinds `Ctrl+Z`. A binding hidden this way is not listed
as active for its command, so menus never show a shortcut that would run
something else; the shortcuts panel and the Edit Keybinding dialog name
the extension that owns the binding that wins.

Combos reserved by text inputs stay out of text-editing controls unless the
clause names `textInputFocus`, which is how a binding opts into a textarea.
Only core and user bindings may opt in. The app contains credential inputs,
so an extension binding never fires from a text-editing control on a
reserved combo, whatever its clause says; a user who wants an extension's
command there binds it themselves.

The store keeps arrays keyed by binding identity (command, combo, target
element, dialog key, clause and execution options) and derives the active set. The Edit Keybinding
dialog carries scope and clause forward and reports a conflict only against
an identical binding. Extension keybindings are validated at registration.
`targetElementId` is unchanged and remains a dispatch-time containment check.

### D3 — Native controls retain their own keyboard behavior

Before resolving bindings, the dispatcher inspects the composed event path.
Text inputs, inherited content-editable regions and IME composition keep
native editing behavior. A core or user binding can explicitly require
`textInputFocus`, as the agent composer and prompt-attention editor do.
Extensions cannot opt reserved text-editing combinations into input fields.

Native activation on buttons, links and media controls, numeric/range
navigation, and menu/listbox/combobox/tree/tab-list navigation stay local.
Reka popovers and menus own Escape; a dialog's content can use scoped Escape
bindings. This distinction uses the existing dismissable-layer and popper
markers rather than maintaining a separate list of component names.

A `data-comfy-keybinding-ignore` ancestor opts a complete native editor out.
It is reserved for embedded editors (terminal and Markdown), active mention
navigation, and the shortcut recorder. Command surfaces use bindings instead:
bounding-box edits, preview navigation, asset selection, onboarding, popups,
builder mode and layer-editor controls all register their actions.
The recorder lets unmodified Tab move focus and Escape dismiss its dialog.

When a modal blocks a matching workspace Ctrl shortcut, the dispatcher
preserves the existing suppression of the browser default. An unavailable
command is unclaimed and reported once; no lower-priority command executes
in its place.

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

### D5 — Runtime ownership and held actions

`useKeybinding` contributes a stable command, a default binding and a derived
`<command id>.active` context. It removes the active provider on unmount or
KeepAlive deactivation. Defaults and command metadata remain registered, so
user customizations survive reopening the surface. Multiple mounted instances
share a command; the last enabled provider handles it. Context getters are
owned by their registering subsystem and combined without replacing another
live provider.

A hold binding names a `releaseCommandId`. The dispatcher records the physical
key (`event.code`, with a key fallback), the selected provider, and its release
callback before calling the press action. Keyup, window blur, hidden document,
focus/context changes, unregistration, remapping and dispatcher disposal all
release the original provider exactly once. Release waits for an asynchronous
press to settle, including when blur occurs synchronously during the press.
A second press cannot overlap a release still in progress.

### D6 — Versioned persistence

`Comfy.Keybinding.SettingsV1` stores bindings, unsets and the selected preset
with the schema version. It is authoritative when present; existing users
are read from the legacy keys until the first save. Unknown unset entries are
retained for commands registered later. The legacy keys receive only bindings
whose meaning they can represent, so an older frontend cannot erase scoped or
held shortcuts by rewriting a lossy view. Preset import/export and the shortcut
editor preserve dialog, context, repeat, default-prevention and release fields.
An explicit user choice is retained even if it matches a core default; it must
continue to outrank an extension registered later.

### D7 — Failure reporting

Registration, stored-settings loading, context evaluation, dispatch, command
execution and hold-release failures use the shared `reportError` sink. Stable
`error_*_keybinding` types identify the operation; command/source/extension
metadata identifies the contribution. Context failures use
`error_evaluating_keybinding_context` and omit the failed key, so both positive
and negated clauses fail closed. No keyboard event or typed key is included in
telemetry. Repeated unavailable-command/dispatch warnings are bounded; normal
focus, modal, composition and repeat exclusions are not errors. Execution
failures also show a translated toast, and a failed command does not disable
later dispatches.

## Invariants

- A keydown executes at most one binding and remains observable downstream.
- Only the active dialog's scoped bindings are eligible; global modal actions
  explicitly opt in through `modalOpen`.
- Native text editing is preserved unless core/user context explicitly opts in.
- An unregistered or failing context never satisfies a clause, even negated.
- User bindings outrank extension and core defaults within the same scope.
- Every claimed hold has one release, tied to the original provider.
- Runtime disposal removes callbacks while retaining user customization.
- A failed command or context cannot permanently stop keyboard dispatch.

## Rollout

The stack separates persistence, capture/hold infrastructure, canvas/editor
migrations, and remaining component/native-control migrations. Capture is
enabled in the final migration after those surfaces use the common dispatcher.
The hidden phase switch provides a live fallback for ecosystem regressions.

Focused unit tests cover priority, persistence, unavailable commands, repeat
policy, error recovery, composed-path guards, multiple providers and hold
cleanup. Browser regressions cover capture ordering, native typing and menu
activation, popover Escape inside a subgraph, image navigation, mask-editor
undo/redo, and a pan remap that survives reload. The blur browser test injects
a focus event; it does not claim an operating-system focus transition.

Extension authors should follow [the keyboard migration guide](../development/keybinding-migration.md).
Dispatch tracing, a context inspector and a preset-import diff remain separate
diagnostics/UI work; they are not prerequisites for capture dispatch.

## Alternatives considered

**Bubble phase as the end state.** It delivers the guard unification and
the dialog scoping in this change with no ecosystem exposure, and was the initial rollout position. As an end state it leaves the seven
capture-phase listeners and every extension listener ahead of the
dispatcher, so determinism stays conditional and every new surface keeps
needing a shield. Rejected as the end state; adopted as the rollout position
until native controls and local commands have been migrated.

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

One resolver decides command ownership. Editor shortcuts can be remapped
without losing their scope or hold behavior, and runtime failures reach both
telemetry sinks. Native controls keep local keyboard implementations for
editing, activation and navigation, while modifier indicators and change
tracking remain event observers.

Capture changes the ordering observed by extensions that patch `processKey`
or listen on elements/window. Existing wrappers still receive events, but a
late listener cannot override a core action by stopping propagation. Extensions
that need priority should register commands and bindings with context keys;
listeners that perform actions should honor `defaultPrevented`.

DOM-only overlays do not join `dialogStore`; code mounting one above a scoped
dialog must supply an appropriate active/focus context. Third-party overlays
without dialog semantics remain outside the app's modal policy. The rollback
switch is retained for those ecosystem boundaries.

The shortcuts panel does not yet persistently explain every shadowed binding,
and defaults contributed by a component appear after its first registration.
Old frontends can edit the compatible mirror, but their edits do not replace
an existing authoritative versioned configuration.
