# ADR-NODE-MENU-0003: Run legacy node menu callbacks in the Vue menu

Date: 2026-11-25

## Status

Proposed

Supersedes the renderer decision of ADR-NODE-MENU-0002. Its decision to produce
core actions before extension mutations still holds.

## Context

ADR-NODE-MENU-0002 rendered the complete node menu natively whenever any item
had an undeclared callback. Most custom node packs add such callbacks, so most
users with extensions saw the legacy menu. Moving a pack to the Vue menu
required a release that imported a frontend-only declaration.

Rendering legacy items in Vue needs two guarantees. Opening the menu must not
run callbacks. A chosen callback must receive what the native menu passed it.

## Decision

Render every single-node menu in Vue. Project the final extension array without
calling any callback. When an item is chosen, call the list callback and then
the item callback, as the native menu does. Each receives the item, the menu
options, a mouse event, and the node or submenu `extra`. The receiver is an
element whose `value` is the item. A `true` result keeps the menu open.
Report a thrown or rejected callback once and close the menu.

Show a `title` instead of `content`, and the text of an HTML label. Apply a
`className` to the Vue item. Declarative submenus become Vue submenus. A
callback that builds its own `LiteGraph.ContextMenu` opens it after the Vue menu
closes; it receives no parent menu.

## Alternatives and consequences

Native fallback (ADR-NODE-MENU-0002) kept every legacy contract but hid the Vue
menu behind an opt-in declaration. Running callbacks during projection would
reveal imperative children but has side effects before the user chooses.

The Vue receiver is detached and has no parent menu. Extensions that decorate
the native menu DOM, or read `previous_menu`, lose that behavior. An imperative
submenu opens as a separate native menu next to the chosen row.
