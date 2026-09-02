# Tutorial: extend an existing node

This tutorial adds a live seed badge and a “Reset seed” menu item to the built-in
`KSampler` node. It demonstrates module registration, definition hooks, node and
widget handles, a user-visible mutation, and lifecycle timing without touching a
frontend global or prototype.

## 1. Create the pack layout

```text
seed_tools/
├── __init__.py
└── web/
    └── seed-tools.js
```

Expose the web directory from `__init__.py`:

```py
NODE_CLASS_MAPPINGS = {}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
```

ComfyUI discovers JavaScript modules in that directory when it loads the custom
node package.

## 2. Import the API

Create `web/seed-tools.js`:

```js
import { comfy } from '/comfy/api/v2.js'

comfy.require('defs.extend')
```

The published module is installed before custom-node modules evaluate. Import
it directly; do not import `/scripts/app.js`, read `window.comfyAPI`, or wait for
a DOM element.

`require()` makes the dependency explicit. If the host is too old, the error
names the missing capability and the API version. For an optional enhancement,
use `supports()` and skip only that enhancement instead.

## 3. Extend `KSampler`

Register the definition behavior at module scope:

```js
comfy.defs.extend('KSampler', (definition) => {
  definition.onCreated((node) => {
    node.addBadge(() => {
      const seed = node.widgets.get('seed')?.getValue()
      return {
        text: `Seed ${String(seed ?? 'unset')}`,
        bgColor: '#334155'
      }
    })
  })

  definition.addMenuItem({
    label: 'Reset seed',
    run(node) {
      node.widgets.get('seed')?.setValue(0)
    }
  })
})
```

There is no constructor and no prototype patch:

- `defs.extend()` selects a registered node type;
- `onCreated()` receives an ID-backed `NodeHandle` after the node joins a graph;
- `node.widgets.get()` finds the seed by stable name rather than array position;
- `setValue()` commits through the same value protocol as a user edit;
- `addBadge()` asks the host to render node chrome under either renderer.

The badge callback is evaluated when the node is drawn, so it reads the latest
seed. Keep a dynamic badge callback fast. For expensive work, update cached pack
state from a widget `change` listener and have the badge read that state.

## 4. Add feedback after execution

The definition builder can observe backend results without subscribing to raw
backend messages or guessing which node produced them:

```js
comfy.defs.extend('KSampler', (definition) => {
  definition.onExecuted((node, result) => {
    comfy.commands.notify({
      severity: 'success',
      summary: 'Sampling complete',
      detail: `${node.getTitle()} produced ${result.images.length} image(s)`,
      life: 2500
    })
  })
})
```

Multiple extensions of the same type compose. They do not need to capture and
call a previous callback. In a real pack, keep related hooks in one
`defs.extend()` call when that makes the behavior easier to read.

## 5. Use application readiness only when needed

Definition registration belongs at module scope. Work that needs the initialized
graph belongs behind `onReady`:

```js
const stopReady = comfy.onReady(() => {
  const count = comfy.graph.nodesOfType('KSampler').length
  console.info(`[seed-tools] ${count} sampler(s) in the visible graph`)
})
```

`onReady` fires once. If the extension must repeat work after every workflow
open, use `onWorkflowLoaded` instead.

The returned function unsubscribes. A module-lifetime listener normally lives
as long as the page; a listener owned by a tab, dialog, widget, or node should be
released when that owner is destroyed.

## 6. Make an optional feature degrade cleanly

Suppose a later version anchors a panel to the node's screen rectangle:

```js
if (comfy.supports('viewport.changed')) {
  const stop = comfy.onViewportChanged(() => {
    for (const node of comfy.graph.nodesOfType('KSampler')) {
      const rectangle = node.getScreenRect()
      if (rectangle) updatePanel(node.id, rectangle)
    }
  })
}
```

The capability check describes the needed behavior. Do not compare frontend
application versions or test whether an internal property happens to exist.

## 7. Verify behavior

Exercise at least these cases in a real frontend:

1. create a fresh KSampler and confirm the badge appears;
2. change the seed manually and confirm the badge follows it;
3. choose “Reset seed” and confirm linked seed controls and serialization react
   as they would to a user edit;
4. duplicate, save, reload, and delete the node;
5. run the workflow and confirm the notification is attributed to the correct
   node;
6. repeat under every renderer the pack claims to support.

Static type and conformance checks cannot prove those interactions. They are the
final behavior contract a user experiences.

## Next steps

- [Migration how-to](./how-to.md)
- [Registration and lifecycle](./registration.md)
- [Nodes and definitions](./nodes.md)
- [Widgets](./widgets.md)
- [API reference](./reference.md)
