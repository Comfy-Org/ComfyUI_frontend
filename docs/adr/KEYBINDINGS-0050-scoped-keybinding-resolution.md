# ADR-KEYBINDINGS-0050: Scoped keybinding resolution

Date: 2026-10-26

## Status

Proposed

## Context

Shortcuts fire in the wrong place. Typing `z` in a side-panel chat input
opens the mask editor (#18144). Escape in an image-preview gallery also exits
the subgraph (#13377). Ctrl+Enter also flips a focused switch (#15582). Shift
sticks after a Shift+right-click (#21558). A shortcut cannot target one node:
R in one Load3D resets every Load3D (FE-840).

No single piece of code decides what a key does. Main has two dispatchers
sharing one keybinding store, one on the window and one patched into the
canvas, plus key listeners spread across window, document, body and
individual editors, some with their own hard-coded undo. Each decides
"am I in the right place?" its own way: dialog keys, target element ids,
focus checks, modal checks. Each keyboard fix adds another listener.

A first implementation (nine unmerged PRs and the draft KEYBINDINGS-0027)
unified dispatch, and most of it carries over. Three parts did not hold up:
it kept the tangle of location checks; it ranked bindings by who registered
them before where they apply, so one user Escape could stop Escape closing
every dialog; and it ran commands before the listeners extensions use today
to block core shortcuts, which breaks those extensions.

## Decision

### One resolver; every shortcut is a command

Every keydown goes through one resolver, installed before any extension
loads. Every shortcut, undo included, is a command the user can see, rebind
or remove in the shortcuts panel. A binding is a key combo, a command, an
optional scope and an optional `when` clause. `when` allows only AND-ed
conditions (`a && !b`), so conflicts can be detected exactly. Each binding
has a source, user, extension or core, set by whoever registers it.

### Where a shortcut applies comes from page structure

Components that own keys (the canvas, a dialog, the mask editor, a node, an
extension's panel) declare a scope on their root element. The resolver starts
at the event target, finds the nearest scope and climbs through its parent
scopes. Parents come from Vue's provide/inject rather than the DOM, so a
popover teleported to `body` still belongs to the dialog that opened it. The
canvas scope covers only the canvas, not the panels drawn over it, so Delete
in the chat composer no longer deletes nodes.

Open overlays (dialogs, lightbox, tours, menus, link drag) form a stack in
the order they opened. Escape goes to the top of the stack first, focused or
not. Modal layers block outer shortcuts unless a binding explicitly allows
them.

This replaces every per-binding location check on main.

### Ranking: place first, then source

When several bindings match, the deepest scope wins, then user over
extension over core, then the narrower clause, then a fixed tiebreak, so the
result never depends on load order. A dialog's own Escape beats a global one.
One exception keeps users in charge: outside an extension's own scopes, a
user binding on the same key beats that extension's binding. A binding that
is not allowed where the key was pressed is skipped; it never ends the
search.

### Typing and native controls keep their keys

Text inputs keep their editing keys unless a binding asks for one (Enter in
the composer). Password fields never trigger a shortcut. Lists, menus, tabs
and buttons keep the keys they navigate with, while app shortcuts such as
Ctrl+Z still reach the app from them.

### Held keys always release

Hold shortcuts (Space to pan) are rebindable commands with a release command.
Release runs exactly once, on keyup, window blur, a hidden tab or the scope
going away, and no extension can block it. Modifier state comes from real
events and resets on blur, so Shift cannot stick.

### When commands run: main's timing now, earlier later

Extensions block core shortcuts today by stopping the event before core sees
it. Running commands earlier would break them; Pixaroma's Ctrl+Z would also
undo the graph behind its editor. So the resolver decides early but runs the
command where main runs it today (`compat`), and counts every time an
extension blocks a core command. A hidden setting opts into running commands
early (`strict`). Once telemetry and a census of custom node packs show the
blocking packs are fixed or shimmed, `strict` becomes the default for
everyone at once, with `compat` kept as an opt-out for two releases. The mode
never switches per install, so behavior never depends on which packs happen
to be installed.

### Stored shortcuts are never lost

Shortcut settings get a version and are read entry by entry; entries this
frontend cannot read are kept and written back. A removed default stays
removed even when its command registers late (#21982) or the default moves
to a new scope. Older frontends keep reading the legacy settings.

### Extensions keep working

The hooks extensions use today (the mask-editor-open flag, node `onKeyDown`
overrides, `processKey` wrappers, hand-made modal overlays) keep working
through shims until packs move to declared scopes. Extensions get an API to
declare scopes and an API version to check. Desktop publishes the combos it
reserves.

### Failures are reported, never fatal

A failing binding, condition or command goes through `reportError` and a
toast, and the next key still works. Telemetry counts blocked commands and
legacy-hook use, never keys.

## Consequences

- New surfaces get correct shortcuts by declaring a scope instead of writing
  focus checks. A surface that forgets one behaves as it does today; a
  development scope inspector and e2e catch it.
- A global binding a user adds after this change loses inside a deeper scope
  that binds the same key, and the panel shows "overridden in <scope>".
  Bindings saved before this change keep winning.
- After the switch to `strict`, extensions can no longer block core commands
  by stopping the event; packs that need priority declare a scope. Keyboard
  e2e runs in both modes until `compat` is removed.

## Alternatives considered

- **Refresh the first implementation.** Fastest, but keeps the overlapping
  location checks and lets one Escape binding block every dialog's Escape.
- **Rank by source before place.** A user's global Escape would disable every
  dialog and editor Escape.
- **Global flags only** (react-hotkeys-hook). A forgotten flag leaks, two
  instances of a surface look alike, and flags cannot place teleported
  content.
- **VS Code's full `when` grammar.** OR and comparisons turn conflict
  detection into a guess. The grammar can widen later.
- **DOM-only scope walk** (VS Code). Teleported popovers land outside their
  dialog. Zed and JetBrains follow the logical parent chain, as this does.
- **Run commands early now.** Breaks named packs destructively.
- **Run commands where main does forever.** Extensions keep needing to stop
  events to get priority, so ordering never becomes predictable.
- **Choose the mode per install.** Behavior would depend on installed packs,
  which no bug report shows.
