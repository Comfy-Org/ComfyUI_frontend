# ADR-KEYBINDINGS-0050: Scoped keybinding resolution

Date: 2026-10-26

## Status

Proposed

## Context

Shortcuts fire in the wrong place: `z` typed in a side-panel input opens the
mask editor (#18144), Escape in an image gallery also exits the subgraph
(#13377), and R in one Load3D resets every Load3D (FE-840). Main handles keys
in two dispatchers and many ad hoc listeners, each deciding location its own
way: dialog keys, target element ids, focus checks, modal checks. Teleported
popovers sit outside their dialog in the DOM, so no DOM walk finds their
owner. Extensions veto core shortcuts by stopping the event before core
handles it.

## Decision

Resolve every keydown in one resolver at window capture, installed before
extensions load. Make every shortcut, undo included, a rebindable command.
Limit `when` clauses to conjunctions so conflicts are exact.

Derive location from page structure. Surfaces declare scopes on their root
element; parent scopes come from Vue provide/inject, so teleported content
belongs to its opener. Open overlays form a stack, and Escape goes to the top
one first.

Rank matching bindings by scope depth, then source (user > extension > core),
then a deterministic tiebreak. Outside its own scopes, an extension binding
loses to a user binding on the same combo.

Leave text inputs, password fields and native controls their own keys unless
a binding opts in. Release every held key exactly once.

Run commands where main runs them (`compat`) and count extension vetoes.
Switch everyone to running them at capture (`strict`) once vetoing packs are
fixed or shimmed. Never choose the mode per install.

Keep stored shortcuts the frontend cannot parse instead of dropping them.

Reject ranking by source first: one global Escape would disable every
dialog's Escape. Reject a DOM-only scope walk (VS Code's): it loses teleported
content. Reject the full VS Code `when` grammar: disjunction makes conflict
detection heuristic. Reject running commands at capture now: it breaks named
packs (Pixaroma, KJNodes, LJNodes, vslinx).

## Consequences

### Positive

- One place decides what a key does; new surfaces declare a scope instead of
  writing focus checks.
- Teleported content, node instances and overlays resolve to the right owner.
- Ordering does not depend on load order or installed packs.

### Negative

- A user's global binding loses inside a deeper scope that binds the same
  key.
- A surface that forgets its scope silently resolves at the root.
- Shims for legacy extension hooks (`processKey`, `onKeyDown`, the mask
  editor flag) stay until packs move to declared scopes, and keyboard e2e
  runs in both modes until `compat` is removed.
