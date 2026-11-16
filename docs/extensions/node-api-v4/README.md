# The V4 node API

The V4 node API is one supported object a custom node pack's JavaScript uses
to read and change the editor: nodes, slots, widgets, node types, events, the
queue, settings and the rest. A pack that uses it does not reach into
`window.app`, LiteGraph prototypes or the editor's stores, so the editor can
change those without breaking the pack.

The design and the reasons for it are in the ADRs
[0070](../../adr/EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
to [0076](../../adr/EXTENSIONS-NODE-API-0076-frontend-execution.md).

## Guides

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
graph is still empty there. Use `onWorkflowLoaded` to act on each loaded
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

- An argument a member cannot use throws a `TypeError` that names the member,
  what it needs and what it got, before anything changes.
- A failure the pack cannot prevent, such as a server that does not answer, is
  a value (`false`, `undefined`, `{ ok: false }`), not a throw.
  `backend.fetch` is the exception: it rejects as `fetch` does.
- Every registration returns a function that removes only that registration
  and is safe to call twice.
- A callback the pack gives that throws is reported, and neither the editor
  nor another pack stops.
- A value the API returns is a frozen copy or a handle, never an editor
  object.
