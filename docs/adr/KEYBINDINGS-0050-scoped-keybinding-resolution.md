# ADR-KEYBINDINGS-0050: Scoped keybinding resolution

Date: 2026-10-26

## Status

Proposed

## Context

Shortcuts fire in the wrong place: typing `z` in a side-panel chat input opens
the mask editor (#18144); Escape over the composer's attachment preview stops
the agent run (#21960); Ctrl+Enter also flips a focused switch (#15582); Escape
in an image-preview gallery also exits the subgraph (#13377); Shift sticks
after a Shift+right-click
(#21558); Cmd+A stops selecting nodes after a click on the tab bar (#11949).
A per-node shortcut cannot be isolated: R in one Load3D would reset every
Load3D (FE-840).

On main two dispatchers share `keybindingStore`: `keybindHandler`, a window
bubble listener from `GraphView.vue`, and `executeCanvasKeybinding`, run by
the `processKey` patch in `app.ts` on the canvas element, which then stops
propagation. Outside both, 24 keydown or keyup listeners sit on window,
document or body, in 21 files;
three hard-code undo (`changeTracker.ts`, the mask-editor package's
`useKeyboard.ts`, `LayerEditorContent.vue`). Location comes from
`targetElementId` containment, `escapeOverride.ts`, role checks and
`isModalOpen` (`src/utils/modalUtil.ts`), four DOM queries run on most
keydowns. This month's keyboard PRs each work around a missing piece: a
listener for key holds (#21965), a repeat check inside `keybindHandler`
(#21906), drag-cancel listeners (#21612), an Escape listener (#21960).

A first implementation (nine unmerged PRs and a draft record numbered
KEYBINDINGS-0027) adopted one resolver at window capture, user > extension >
core sources, conjunction-only `when` clauses, holds and versioned settings.
Those survive. Three parts did not:

- **Where.** Six overlapping "only here" mechanisms: `dialogKey`,
  `targetElementId`, a dozen `enabled()` closures testing
  `contains(document.activeElement)`, `<command>.active` atoms, an ignore
  attribute and the DOM sweep. `DialogPortal.vue` teleports a dialog's
  popovers into its `portalTarget`, beside `[data-dialog-key]`, so no DOM walk
  from a popover reaches its dialog. The side, bottom, properties and agent
  panels render inside `#graph-canvas-container`, so canvas Delete fires from
  a composer button (FE-2555). Focus checks miss overlays without focus, and
  the handling instance was the last provider whose `enabled()` held.
- **Ranking.** Sorting by source first, and returning at the first candidate a
  modal blocked, let one clause-less extension or user Escape stop Escape
  closing every lightbox, tour and popup. `modalOpen` and `textInputFocus`
  were both condition and permission, so `popup.ts` needed four registrations.
- **Commit point.** Commands ran at window capture, ahead of every way
  extensions veto core shortcuts today: stopping propagation in window capture
  (Pixaroma overlays) or in a DOM widget (KJNodes box editor), wrapping
  `processKey` (LJNodes), document-capture listeners that must run first
  (KJNodes insert mode), and `onKeyDown` overrides that skip the original
  (vslinx). Its rollback re-added the listener, so "first" held by timing.

Stored shortcuts are fragile too: main drops an unset whose command is not
registered yet, so with late custom nodes (EXTENSION-LOADING-0048) a removed
default returns, and the first implementation parsed all settings or none.

## Decision

### D1 — One resolver; every shortcut is a rebindable command

Users find every shortcut, undo included, in the shortcuts panel and can
rebind, remove or disable it.

- A pure `resolveKeybinding()` resolves every keydown against one store (D6
  says where it listens). `Comfy.Undo` and `Comfy.Redo` get default bindings;
  editors get scoped undo commands of their own.
- A binding is a command, a combo, an optional scope and `when` clause, the
  D4 permissions, and the `allowRepeat`, `preventDefault` and
  `releaseCommandId` options. The registrar assigns its source (user,
  extension by name, core); a binding cannot promote itself.
- `when` is a conjunction of context keys (`a && !b`). Without disjunction,
  grouping or comparison, clause equality is decidable and conflicts exact. A
  key nobody registered never matches, negated or not.
- Composition events and bare modifiers are ignored; `allowRepeat: false`
  consumes repeats. Commands receive the triggering event and the resolved
  scope instance in their metadata.
- An extension binding on a core combo is accepted and wins (main drops it
  with an error toast), visibly: a panel badge, one toast per pack, and a
  count at registration.

### D2 — Where a shortcut applies comes from page structure

Users see Escape close whatever is on top, Delete in the composer stay there,
R reset only the Load3D they are in, and the panel name a surface ("Canvas",
"Mask editor") instead of context-key text.

**Region scopes.** `useKeybindingScope(name, options)` creates a scope
instance, provides it to children and stamps its root with
`data-comfy-keybinding-scope`. The resolver starts at `composedPath()[0]`,
takes the nearest stamped ancestor and follows _logical_ parents, injected
through Vue `provide`/`inject`, to the root, so teleported content belongs to
the component that opened it.

- Anchors are stamped once, in the `src/components/ui` wrappers for portalled
  content. A lint rule bans direct Reka `*Content`/`*Portal` imports elsewhere;
  unanchored content resolves at the root, no worse than today.
- The dialog scope is stamped on `DialogPortal.vue`'s `portalTarget`, not on
  `DialogContent`. `GlobalDialog.vue` passes the dialog key as the variant.
  Bindings name content scopes (`maskEditor`), never dialog keys.
- The canvas scope wraps only `#graph-canvas`, `TransformPane.vue` and the DOM
  widget layer, inactive in app mode; `LiteGraphCanvasSplitterOverlay.vue`
  parents its panel slots to the workspace.
- Node scopes on `LGraphNode.vue`, `DomWidget.vue` and `WidgetDOM.vue` carry
  per-instance handlers; litegraph-drawn nodes get a virtual node scope from
  the single selected node, or the hovered one in FE-840's hover mode.
- With focus on `body` or app chrome, the last focused region counts only
  while connected, visible (`checkVisibility()`) and not hidden by app mode,
  so Delete in app mode cannot reach the hidden graph.
- Package code is scoped by its host (`MaskEditorContent.vue` for the mask
  editor). One bounding-box scope serves the inline and fullscreen editor, so
  Delete there removes a box, never the node.
- Extensions declare prefixed scopes on DOM they own (`keybindingScopes`, or
  `app.extensionManager.keybindings.declareScope`). Disposal removes that
  extension's bindings, scopes and keys, never user entries.
- `targetElementId` is input only, normalized wherever bindings enter:
  `graph-canvas` and `graph-canvas-container` become the canvas scope, any
  other id a built-in containment scope for that element.

**Layer stack.** What is open, focused or not, forms one stack ordered by
opening: dialogs, the lightbox, tours and the coach, Reka popovers and menus
(from `data-dismissable-layer`), and root-level mode layers for link drag and
ghost placement, which must cancel without canvas focus.

- Escape goes to the top layer first, focused or not. If nothing there claims
  it, a Reka layer receives it unclaimed and dismisses itself; other layers
  run their dismiss handler. The mask editor's layer owns Escape and keeps its
  dialog open, so unsaved strokes survive.
- Exclusive layers (dialogs, lightbox, tour spotlight, embedded terminal and
  Markdown editors, the shortcut recorder) admit outer-scope bindings only
  with `allowIn.modal`.
- `modalOpen` is read from the stack. `isModalOpen` is only the D8 fallback,
  consulted when the winning candidate sits at the root.

**Context keys.** Global keys hold only location-free facts: platform,
Desktop, installed PWA, app mode, read-only, and extension keys. A scope may
publish keys about its own state (`agent.composer.running`), evaluated against
the instance on the chain.

This replaces `dialogKey`, `targetElementId` as a dispatch-time check,
`enabled()` containment closures, `<command>.active` atoms, the `modalOpen`
and `textInputFocus` atoms, `escapeOverride.ts`, and the per-keydown sweep.

### D3 — Ranking: where first, then who

Inside a dialog its Escape wins even if Escape is bound globally, and a user's
binding beats an extension's wherever the extension does not own the scope.

Candidates are ordered by depth (top layer or deepest scope first), then
source (user > extension > core), then the narrower clause, then registration
order. The first eligible one (D4) runs; an ineligible one never ends the
search.

- **Masking.** An extension binding in a scope the extension does not own is
  skipped when an eligible user binding on the same combo exists at that scope
  or an ancestor on the chain. In its own scopes an extension keeps depth
  priority. Depth alone stops a root-level extension Escape from beating a
  dialog or link-drag Escape.
- **Conflicts** need identical combo, scope and variant, canonical clause and
  source. The same combo at another depth is a shadow, shown as "overridden in
  <scope>".
- "Add keybinding" defaults to the command's home scope, so a rebind sits at
  its default's depth. Menus show a shortcut only if resolving it from the
  menu's own chain picks that command.

### D4 — Permissions and native controls

Typing stays typing unless the surface asked for a key (composer Enter),
password fields never trigger a shortcut, and lists and menus keep their own
keys while Ctrl+Z and Ctrl+A still reach the app from a dropdown or tree.

- `allowIn: { textInput, modal }` grants permission; `when` only states a
  condition. One binding replaces `popup.ts`'s four.
- One eligibility function checks scope, clause, permissions, availability
  and masking for both dispatch and hold release. It reads the target from the
  event path, not `document.activeElement`, which is wrong in shadow DOM.
- Text inputs (`isContentEditable`, covering `plaintext-only` and nested
  regions) and IME composition keep reserved editing combos. Extensions may
  set `allowIn.textInput` only in scopes they own. Credential inputs
  (`type="password"`, credential `autocomplete`) and scopes declared sensitive
  keep every key, for every source.
- Mask-editor Undo, Redo and Pan carry `allowIn.textInput` in its scope,
  because focus sticks in its brush number inputs (#21292).
- Each role keeps only keys it uses. Listbox, menu, tree, combobox: unmodified
  navigation, typeahead, Enter, Space, Home, End, and Ctrl/Cmd+A only with
  `aria-multiselectable="true"`. Tab list: arrows, Home, End. Buttons, links,
  media: unmodified Enter and Space.
- A re-dispatched copy of a claimed key is never resolved again.
  `WidgetSelectDefault.vue` stops replaying modified keys (main replays
  Ctrl+Enter too), so Ctrl+Enter in an open dropdown queues once.
- Among Reka's toggles only `SwitchRoot` acts on Enter without checking
  `defaultPrevented`, so `src/components/ui/switch/Switch.vue` rejects a model
  update caused by a claimed keydown (#15582). This holds in both D6 modes.
  Reka's `TreeItem` also selects on Enter and Ctrl+Enter regardless; the tree
  wrapper gets the same guard.

### D5 — Holds and modifier state

Space-to-pan and the link-tie key are rebindable, and no key stays stuck.

- A hold names `releaseCommandId`. The press runs at the D6 commit point, so a
  shield can veto it and leave nothing to release; repeats never press.
- Release runs from the window-capture keyup listener, which no extension
  precedes, exactly once: on keyup, blur, a hidden document, the scope leaving
  the chain, unregistration, remapping, or a held modifier coming up (macOS
  sends no keyup for a key pressed under Cmd). An async press settles first.
- Modifier state comes from keyboard and pointer events and resets on blur and
  a hidden document. It replaces `useMagicKeys` in `workspaceStore.ts`; click
  handlers read their own event's `shiftKey` (#21558).

### D6 — Commit point: resolve at capture, commit where main does

Through the migration, extension authors see main's order: shields,
`processKey` wrappers and document-capture listeners still run before the core
command they guard against. A visible "Shortcut priority" setting
(`Comfy.Keybinding.CommitPhase`: `compat` or `strict`) opts into committing at
capture; when the criteria below hold, the default flips once, for everyone.

- One set of listeners is installed before any extension loads and never
  re-added: keydown at window capture (resolver) and bubble (committer), keyup
  at window capture (holds, modifiers), and blur, `visibilitychange` and
  `focusin`. A mode change flips a flag, releases holds and drops pending
  claims.
- The resolver applies D4 and resolves against a snapshot of context taken at
  capture, then records a claim for the event.
- **Compat**, the default until the flip, commits where main runs the key and
  prevents the default there, as main does, so listeners that defer to
  `defaultPrevented` (Reka's Escape dismissal, the composer preview) behave
  as today. Canvas-scope bindings commit in the canvas element's own listener
  (`processKey`) when the event passes through it, and still stop propagation
  there; otherwise at window bubble. Undo and redo commit at window capture,
  where `changeTracker.ts` runs graph undo today. Every other binding commits
  as the first window-bubble listener, where `keybindHandler` is.
- **Strict** commits every claim at capture and prevents the default there
  unless the binding sets `preventDefault: false`, so `defaultPrevented` means
  "claimed".
- A commit re-checks only liveness (command registered, scope mounted, hold
  pressed), never the decision, so a legacy modal that closes itself cannot
  cause a second Escape action. A dead claim is stale, not a veto.
- **A veto** is a claim that never reaches its commit point; only
  `stopPropagation`, `stopImmediatePropagation` or `cancelBubble` cause one.
  Vetoes are counted per command and per pack, the pack read from the stopping
  call's stack for claimed events only. A core veto goes to `reportError` and
  fails e2e.
- **Flip criteria**, all required: two releases of veto data; zero core vetoes
  in e2e; every pack vetoing in at least 0.1% of sessions has shipped a fix,
  is covered by a D8 shim, or has had a core-authored PR open for 60 days; and
  strict passes a test pack reproducing the extension patterns above. Compat
  then stays a visible opt-out for two releases before removal.
- No per-install automatic mode: order depends only on the mode, never on the
  installed packs or local history. A known-pack list only adds panel warnings.

### D7 — Persistence

No stored shortcut is lost to a bad entry, a downgrade, a late-loading pack or
a default that moves scope.

- One versioned settings value, parsed entry by entry. Invalid entries and
  unknown fields are kept verbatim and written back; an unknown version opens
  read-only.
- Unsets are kept whether or not their command is registered yet. This ships
  first, independently. Unsets match on source, command, combo and scope, not
  behavior flags, so a flag added to a default does not bring it back.
- An identity map translates defaults whose scope moves (Delete, Backspace,
  Ctrl+A and paste off `graph-canvas-container`, zoom off `graph-canvas`) on
  every load path, so a stored "unset Backspace" keeps matching.
- The legacy `Comfy.Keybinding.NewBindings`/`UnsetBindings` mirror holds only
  bindings without clause or permissions, keeping their `targetElementId`. An
  older frontend's edits there merge three-way against the last mirror written;
  additions that collide with a versioned-only binding are skipped.
- Presets carry a version; fields old frontends cannot represent sit under a
  key their parsers drop. Host-reserved combos warn in the edit dialog and are
  never filtered at load, since browser and Desktop share settings.

### D8 — Compatibility shims

Extensions keep the hooks they use today, read no more broadly than main does.

- **`ComfyApp.maskeditor_is_opended`.** Read on each keydown, it makes
  workspace Undo and Redo go unclaimed while it returns true, as main does for
  packs that assign the hook. Reading the property itself, so a pack that
  replaces it (MiniMax) also counts, is new. It is not a modal: FiL keeps it
  installed for the tab's lifetime, and dchatel and LLM_Prompt leave
  `() => true` behind if their overlay dies. Use logs a deprecation warning.
- **`onKeyDown` marker.** `litegraphService.ts` puts a marker at the bottom of
  each node type's `onKeyDown` chain, where `addNodeKeyHandler` sits today.
  Image navigation moves only nodes whose chain reached it, so an override that
  skips the original (vslinx) keeps its veto.
- **`processKey` shim.** Wrappers patched at module load still run. It
  forwards to selected nodes' `onKeyDown`/`onKeyUp` every key but canvas-scope
  claims in compat (main's set), only unclaimed keys in strict, and skips
  nodes image navigation already offered the event. It keeps `graph.change()`
  on forwarded keyups; canvas commands dirty foreground and background.
- **Overlay fallback.** An undeclared `role="dialog" aria-modal="true"`,
  `dialog[open]` or visible `.comfy-modal` counts as an exclusive layer, and a
  bare Escape there closes it. On main that happens only once the default
  Escape binding is removed.
- **API version.** Packs can check a keybinding API version. The migration
  guide leads with recipes that also work on old frontends: ARIA modal markup,
  and reading the triggering event from command metadata with a fallback.
- **Desktop.** The host publishes its reserved combos over the preload bridge
  (`__comfyDesktop2`), with a fallback list for older builds, and forwards
  Ctrl/Cmd+W with its combo so it stays rebindable.

### D9 — Failure reporting

A broken binding is diagnosable and never stops the keyboard.

- Registration, settings, context, dispatch, execution and release failures go
  through `reportError` with literal `error_*_keybinding` types and command,
  source and extension metadata. A failing context fails closed, negated or
  not. A failed command shows a translated toast; later dispatch continues.
- Telemetry counts vetoes, double handling under strict, legacy-hook use and
  extension bindings overriding core: cloud through the telemetry registry,
  Desktop through host telemetry. Local installs get one console warning per
  pack and command and a panel note. No key, combo or event leaves the page.

## Invariants

- One resolver at window capture, installed before any extension loads, sees
  every keydown; its listeners are never re-added.
- A keydown commits at most one binding, once, without re-deciding at commit.
- In strict mode the dispatcher prevents the default for a claim and never
  stops propagation; compat keeps main's prevention point and canvas stop.
- Depth, then source, then clause, then order; an ineligible candidate never
  ends the search, and an extension binding outside its own scopes never beats
  an eligible user binding on the same combo at or above its scope.
- Place comes from the event target's stamped ancestors and their logical
  parents, never from a binding's own focus test. Teleported content resolves
  inside its opener. Escape reaches the top open layer first.
- Native editing is preserved unless a binding has `allowIn.textInput`;
  credential inputs keep every key for every source.
- An unregistered or failing context key never satisfies a clause.
- Dispatch and release share one eligibility function; every pressed hold
  releases exactly once, and no extension can veto a release.
- A stored entry this frontend cannot read is kept, never dropped.
- Key order is identical on every install running the same mode.
- A failed command or context never stops later dispatch, and no key data
  reaches telemetry.

## Consequences

- After the flip, extension shields no longer veto core commands; packs that
  need priority bind in scopes they declare, and listeners that act on keys
  check `defaultPrevented`.
- After the flip, a key committed at the canvas reaches window listeners with
  `defaultPrevented` set; until then it is stopped there, as on main.
- In strict, a claimed Space or arrow key inside a foreign editor in the canvas
  scope loses native scrolling unless its binding sets `preventDefault: false`.
- A user's existing global binding on a combo a deeper core scope also binds
  (Escape, arrows, Space, Ctrl+Z) loses inside that scope, marked "overridden
  in <scope>". How much this surprises existing users is unverified.
- A core surface that forgets its scope resolves at the root silently; a
  development scope-chain inspector and e2e catch it.
- Keyboard e2e runs in both modes until compat is removed. Whether an
  installed PWA receives a cancellable Ctrl+W (#18433) is unverified.

## Alternatives considered

- **Refresh the first implementation, adding a layer stack.** Fastest to a
  first fix and reuses most tests, but keeps six overlapping "only here"
  mechanisms, lets one clause-less Escape block every in-modal Escape, and
  isolates node instances only through hand-written focus checks.
- **Rank by source before place.** A user's workspace Escape would disable
  every dialog and editor Escape; masking keeps user priority without that.
- **Global flags only** (react-hotkeys-hook). A forgotten flag leaks, two
  instances of a surface look alike, and a flag cannot place teleports.
- **The full VS Code `when` grammar.** Disjunction, grouping and comparison
  make clause overlap a heuristic, so conflict detection turns best-effort.
  The grammar can widen later without breaking stored clauses.
- **Commit at capture now.** Breaks named packs, destructively: Pixaroma
  Ctrl+Z undoes the graph behind its editor and Escape exits the subgraph;
  KJNodes box-editor Delete deletes the node and insert mode never ends;
  LJNodes Ctrl+G makes two groups; vslinx gallery arrows flip the node image.
- **Commit at bubble forever.** Every listener stays ahead of the dispatcher,
  so ordering stays conditional and surfaces keep needing shields.
- **Per-install automatic mode** (strict unless a pack is known or seen to
  veto). Order would depend on installed packs and local history, which no bug
  report reveals.
- **DOM-only scope walk** (VS Code's: stamped contexts found by walking up from
  the target). Teleports break it: a popover in a dialog lands beside
  `[data-dialog-key]`, menus under `body`. Zed and JetBrains resolve along the
  focus path instead, and this record follows logical parents for the same
  reason.
  VS Code dispatches at window bubble: prior art for scoping, not for capture.

## Rollout

A new stack from main replaces the nine first-implementation PRs, reusing
their code. The first three PRs are the late-unset fix, this record, and the
single resolver at window capture with today's commit points.

1. fix: keep unsets for bindings that register late.
2. docs: this record.
3. refactor: one resolver at window capture, today's commit points (#18144,
   IME composition, state judged when the key was pressed).
4. feat: versioned settings and presets, three-way merge, identity map.
5. feat: veto counting, listeners installed before extensions, the "Shortcut
   priority" setting, ordering e2e, extension-pattern test pack.
6. feat: `when`, `allowIn`, sources and extension context keys.
7. feat: scopes and layer stack (lightbox, tours, popups, #21960, #12308).
8. feat: canvas and node scopes (FE-2555, #11949, per-instance handlers).
9. feat: holds and modifier state (rebindable pan, #21558, link ties).
10. feat: undo and redo as bindings, with the mask-editor hook shim.
11. feat: mask, layer and bounding-box editor shortcuts.
12. feat: canvas keys as commands (#13377, `processKey` and marker shims).
13. feat: agent composer and media preview surfaces.
14. feat: onboarding, dialog and widget surfaces (tours, #15582).
15. feat: shortcuts panel and menus (scope labels, Desktop and PWA combos).
16. feat: extension scopes API, API version, migration guide.
17. feat: commit at capture by default, once the D6 criteria hold.
