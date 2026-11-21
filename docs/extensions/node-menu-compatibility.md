# Preserve node menu changes across renderers

Keep existing `getExtraMenuOptions`, `getNodeMenuItems`, and captured
`getNodeMenuOptions` wrappers. For single-node frontend menus, these hooks run
after the curated core producer. Their final order, removals, and replacement
callbacks control the displayed menu. Group and multiple-selection menus are
outside this compatibility boundary.

## Keep legacy callbacks native

Leave a callback unchanged if it uses `this`, callback arguments, native menu
DOM, an imperative submenu, or a `true` return value to keep the menu open.
The frontend renders the whole menu natively when a callback needs that contract.
Menu assembly does not execute callbacks to discover their children.

## Opt into Vue presentation

Import `closureOnly` from the frontend compatibility module and apply it only to
callbacks that need no arguments, DOM receiver, or keep-open return value.

```typescript
import { closureOnly } from '../../scripts/nodeMenu.js'

const item = {
  content: 'Set seed',
  callback: closureOnly(() => {
    seedWidget.value = 42
  })
}
```

Declare every submenu through `submenu: { options: children }`. Children can
contain further declarative submenus. Native-only submenu settings, HTML labels,
custom classes, or undeclared callbacks keep the complete menu native.

If you replace or wrap a declared callback, explicitly declare the replacement
only when it also meets the closure-only contract. Copying an item does not
certify a new callback. Do not declare a wrapper around an unknown callback just
to select the Vue renderer.

If your extension decorates native menu constructors or DOM, retain an
undeclared callback in that menu. The closure-only declaration does not promise
that Vue menus invoke native constructors.
