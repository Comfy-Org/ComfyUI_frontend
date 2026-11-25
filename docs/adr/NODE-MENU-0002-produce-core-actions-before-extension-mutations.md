# ADR-NODE-MENU-0002: Produce core actions before extension mutations

Date: 2026-11-17

## Status

Superseded

Superseded by ADR-NODE-MENU-0003.

Supersedes ADR-NODE-MENU-0001.

## Context

Extensions can remove, reorder, wrap, or replace menu actions. Rebuilding core
sections after extension hooks discards those edits. Callback identity cannot
reconcile a wrapped action with a regenerated action without losing behavior.

The curated menu must remain the default. Arbitrary legacy callbacks still need
their DOM receiver, event, parent menu, and native submenu lifecycle.

## Decision

For a single-node frontend menu, produce the curated actions before the ordinary
legacy extension chain. Treat its final returned array as authoritative. A node
menu override can replace that starting menu. Never restore actions after an
extension removes them.

Choose one renderer for the complete result. Vue accepts recursive declarative
submenus and callbacks explicitly declared closure-only. An undeclared callback,
an imperative submenu, or unsupported native presentation requires native
rendering of the same result. Opening a menu must never execute action callbacks.

A closure-only declaration belongs to the callback, not the item or its label.
Replacing a callback requires a new declaration. The author asserts that the
callback runs without legacy arguments, a DOM receiver, or a keep-open result.
It is not a runtime proof. Native constructor decoration is outside that
declaration.

Native canvas, group, and multiple-selection menus retain their existing
producers. The per-invocation curated source must not affect later invocations.

## Alternatives and consequences

Keeping the legacy producer as the default would preserve native presentation
but lose the curated core experience. Combining independently generated menus
would retain the reconciliation problem and prevent authoritative removals.

Unknown extensions may cause the complete menu to use native presentation.
They need no migration to retain native callback semantics. Authors can opt into
Vue presentation by declaring closure-only callbacks and declarative children.
Devtools fixtures model extension behavior; browser tests own the frontend
integration and renderer assertions.
