# Preserve node menu changes across renderers

Keep existing `getExtraMenuOptions`, `getNodeMenuItems`, and captured
`getNodeMenuOptions` wrappers. For single-node frontend menus, these hooks run
after the curated core producer. Their final order, removals, and replacement
callbacks control the displayed menu. Group and multiple-selection menus are
outside this compatibility boundary.

## Callbacks in the Vue menu

The frontend renders the final menu in Vue. Opening it runs no callbacks. A
chosen callback receives the item, the menu options, a mouse event, `undefined`
for the parent menu, and the node (or the submenu's `extra`). `this.value` is
the item. Return `true` to keep the menu open.

Declare submenus through `submenu: { options: children }` so they appear as Vue
submenus. A callback that opens its own `LiteGraph.ContextMenu` still works; the
new menu opens beside the chosen row without a parent menu.

The Vue menu does not use native menu DOM. Extensions that decorate
`LiteGraph.ContextMenu` elements or read the parent menu do not see those for
the node menu.
