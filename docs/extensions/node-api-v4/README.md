# The V4 node API

The V4 node API is one supported object a custom node pack's JavaScript uses
to read and change the editor: nodes, slots, widgets, node types, events, the
queue, settings and the rest. A pack that uses it does not reach into
`window.app`, LiteGraph prototypes or the editor's stores, so the editor can
change those without breaking the pack.

The design and the reasons for it are in the ADRs
[0070](../../adr/EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
to [0076](../../adr/EXTENSIONS-NODE-API-0076-frontend-execution.md), and
how these guides and the published types are kept in step in
[0077](../../adr/EXTENSIONS-NODE-API-0077-author-guides-and-published-types.md).

## Guides

- [Handles and documents](./handles-and-documents.md)
- [Reading and editing the graph](./reading-and-editing.md)
- [Widgets](./widgets.md)
- [Node definitions and hooks](./definitions-and-hooks.md)
- [Events and the queue](./events-and-queue.md)
- [Frontend execution: resolve and supply](./execution.md)
- [Settings, storage, commands, backend and UI](./utilities.md)
- [Converting a V2 pack](./v2-to-v4.md)

## Getting started

A pack imports `comfy` from the module the editor serves. The import works in
a pack's module body: the editor installs the API before it loads any
extension.

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.onReady(() => {
  const count = comfy.graph.nodes().length
  comfy.commands.notify({ summary: `The graph has ${count} nodes` })
})
```

`onReady` runs once the app is set up, before the first workflow loads, so the
graph is usually still empty there; for a pack the editor loads late, a
workflow may already be open. Use `onWorkflowLoaded` to act on each loaded
workflow.

### Versions

The version is in the module path. Additions to V4 are patches: the import
stays `/comfy/api/v4.js`, and a pack that needs a later patch checks for it.

```ts
import { comfy } from '/comfy/api/v4.js'

if (comfy.isApiVersionAtLeast('v4.0.0')) {
  const [major, minor, patch] = comfy.getApiVersion()
  console.info(`node API ${major}.${minor}.${patch}`)
}
```

### Types

The types are published in `@comfyorg/comfyui-frontend-types` as the `v4`
namespace: `v4.Comfy`, `v4.NodeHandle` and the rest. The package also types
`window.comfy_v4`, the slot the editor publishes the API through. To type the
module import, add one declaration file to the pack:

```ts comfy-api-v4.d.ts
import type { v4 } from '@comfyorg/comfyui-frontend-types'

export const comfy: v4.Comfy
```

and map the module path to it in the pack's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": { "/comfy/api/v4.js": ["./comfy-api-v4.d.ts"] }
  }
}
```

A type the pack names in its own code comes from the namespace:

```ts
import type { v4 } from '@comfyorg/comfyui-frontend-types'

import { comfy } from '/comfy/api/v4.js'

function titles(nodes: readonly v4.NodeHandle[]): string[] {
  return nodes.flatMap((node) => node.getTitle() ?? [])
}

comfy.onSelectionChanged((nodes) => console.info(titles(nodes)))
```

The repository's `pnpm check:types-consumer` compiles every TypeScript example
in these guides against the published types.

## Rules every member follows

- An argument a member cannot use throws a `TypeError` before anything
  changes, worded `<member> needs <what>, not <received>.` An async member
  throws it at the call too; its promise does not reject for it.
- An object argument (options, a definition, a patch, an item) must be a
  plain object. It is read once, and a field the member does not take throws,
  so a misspelled or cut field shows at the call. The services follow this
  too: `settings.declare`, `commands.register`, `commands.notify`, every
  `comfy.ui` definition and `localization.registerCatalog`. A catalog's
  `phrases` is the one field taken and ignored, and `backend.fetch` passes its
  `init` on as `fetch`'s own options.
- A `Bounds` passed where a `Point` is taken is refused for its extra fields:
  write `node.setPosition({ x: bounds.x, y: bounds.y })`, not
  `node.setPosition(node.getBounds())`.
- A value to be stored (a property, a workflow extra, a widget value or
  option, a mounted value, a setting) must be one the workflow saves
  unchanged: text, a finite number, a boolean, `null`, or a plain object or
  list of those. `NaN`, a function or `undefined` inside it, a `Date`, an
  object with `toJSON`, a class instance, a getter and a cycle are refused,
  and the message names the path, such as `value.list[0]`. `undefined` as the
  whole value deletes a property or an extra.
- A name used as a key (a setting id, a command id, a type, a property name,
  an extra key, a widget option name) must be a non-empty string that no
  object inherits: not `__proto__`, `constructor`, `toString` or another
  `Object.prototype` member.
- A failure the pack cannot prevent, such as a server that does not answer, is
  a value (`false`, `undefined`, `{ ok: false }`), not a throw. Three calls
  reject instead: `backend.fetch`, as `fetch` does; `settings.set`, when the
  server cannot be reached; and `defs.refresh`, when fetching the definitions
  fails.
- A listener or hook registration (`on…`, `extend`, `define`,
  `registerImporter`, `addBadge`, `addSidebarTab`, `mountViewportPanel`)
  returns a function that removes only that registration and is safe to call
  twice. A badge, button or overlay in `comfy.ui` returns a handle whose
  `remove()` is safe to call twice. `settings.declare`, `commands.register` and
  `localization.registerCatalog` last for the page. A builder's methods add
  to the extension, which its own disposer removes.
- A callback the pack gives that throws is reported, and neither the editor
  nor another pack stops.
- A value the API returns is a frozen copy, a handle, or a browser value such
  as the `Response` of `backend.fetch`; never an editor object.
