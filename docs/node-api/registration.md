# Registration, lifecycle, and globals

Custom-node JavaScript is loaded as an ES module. Register published behavior
from the module body, then use explicit lifecycle signals for work that needs a
running graph or a loaded workflow.

## Importing the API

```js
import { comfy } from '/comfy/api/v2.js'
```

The frontend installs one API instance immediately before it loads custom-node
modules. `/comfy/api/v2.js` re-exports that instance rather than constructing a
new registry.

The same object is present as `globalThis.comfy` and `window.comfy`. The global
is useful in the browser console and for diagnosing a host. Extension modules
should import `comfy` so the dependency is explicit and tooling can understand
it.

These legacy globals and modules are not part of this contract:

- `window.comfyAPI`;
- `window.app`;
- `/scripts/app.js`, `/scripts/api.js`, `/scripts/widgets.js`;
- `LiteGraph` and renderer globals.

## Versioning and capability probes

```js
console.info(comfy.version) // API version, currently '2.0'
console.info(comfy.major) // currently 2

if (comfy.supports('slots.dynamic')) {
  installDynamicInputs()
}

comfy.require('workflow.open')
```

Use `supports()` for optional behavior and `require()` for a feature without
which the extension cannot work. Do not compare application versions, parse
`comfy.version`, or probe an internal member.

`comfy.capabilities()` returns a frozen list of everything the host provides.
`comfy.forMajor(major)` pins a public major when a pack deliberately maintains
more than one implementation.

## Registration at module load

The API is ready for declarations before the graph has completed setup. These
operations normally belong at module scope:

```js
comfy.settings.declare({
  id: 'SeedTools.showBadge',
  name: 'Show seed badge',
  type: 'boolean',
  defaultValue: true
})

comfy.commands.register({
  id: 'SeedTools.resetSelected',
  label: 'Reset selected sampler seeds',
  scope: 'canvas',
  run() {
    for (const node of comfy.graph.selection()) {
      node.widgets.get('seed')?.setValue(0)
    }
  }
})

comfy.defs.extend('KSampler', (definition) => {
  definition.onCreated((node) => installSamplerBehavior(node))
})
```

Registration IDs share host-wide namespaces. Prefix setting, command, tab,
dialog, top-bar badge, and action-button IDs with a stable pack name.

## Extending backend node definitions

`defs.extend(selector, apply)` is the replacement for
`beforeRegisterNodeDef` and prototype patching:

```js
const stop = comfy.defs.extend(
  { category: /^image\/postprocessing/ },
  (definition) => {
    definition.onExecuted((node, result) => {
      rememberImages(node, result.images)
    })
  }
)
```

A selector can be:

- an exact type string;
- an array of type strings;
- a type-name regular expression;
- `{ category: string | RegExp }`;
- a predicate over `NodeDef` when the other forms cannot express the match.

Prefer an indexable selector. A predicate must inspect every registered
definition and should be reserved for structural questions such as “any node
with a VAE input.”

The builder's `def` is the frozen definition after earlier extensions have run.
Registered callbacks compose; there is no previous prototype callback to
capture or invoke.

## Defining a frontend-owned node type

Use plain data rather than subclassing `LGraphNode`:

```js
const unregister = comfy.defs.define({
  type: 'SeedTools/Reroute',
  title: 'Seed Tools Reroute',
  category: 'Seed Tools',
  inputs: [{ name: 'in', type: '*' }],
  outputs: [{ name: 'out', type: '*' }],
  execution: 'frontend',
  resolve({ self }) {
    const input = self.input('in')
    return { out: input ? { forwardTo: input } : { omit: true } }
  }
})
```

The `type` must be globally unique. `define()` returns an unregister function.
`execution: 'frontend'` keeps the node out of the backend prompt. A resolver is
optional: without one, the node is simply omitted. See
[Execution and resolution](./execution.md) before defining execution behavior.

## Defining an input widget type

`defineWidgetType()` replaces `getCustomWidgets` for a Python input type:

```js
const unregister = comfy.defs.defineWidgetType('SEED_TOOLS_COLOR', {
  defaultValue: '#ffffff',
  minWidth: 120,
  render(container, value, name, context) {
    const input = document.createElement('input')
    input.type = 'color'
    input.value = String(value.get())
    input.ariaLabel = name
    input.addEventListener('input', () => value.set(input.value))
    container.append(input)

    const stopValue = value.onChange((next) => {
      input.value = String(next)
    })
    return () => {
      stopValue()
      input.remove()
    }
  }
})
```

Type-level widget construction happens before the owner has joined a graph. The
render callback therefore receives a value accessor and a `WidgetTypeContext`,
not a node handle. Use `context.onNodeReady()` when behavior genuinely needs the
owning `NodeHandle`.

## Lifecycle signals

### Application ready

```js
const stop = comfy.onReady(() => {
  rebuildIndex(comfy.defs.all())
})
```

At this point the canvas, settings, graph, and node definitions exist. A listener
registered after readiness still runs on the next microtask.

### Workflow loaded

```js
const stop = comfy.onWorkflowLoaded(() => {
  restorePackStateFor(comfy.graph.root())
})
```

This fires after every workflow load. It is the replacement for a one-time setup
hook when behavior belongs to each document.

### Definition lifecycle

Use `NodeDefBuilder` or `NodeDefinition` callbacks for individual instances:

- `onCreated` after the node joins a graph;
- `onConfigured` after saved data is applied;
- `onRemoved` when it leaves;
- `onExecuted` and `onPreview` for backend results;
- `onConnectionsChanged`, `onResized`, `onHover`, `onDoubleClick`,
  `onPropertyChanged`, `onDragOver`, and `onDrop` for semantic editor behavior.

`NodeCreatedEvent.restored` distinguishes fresh nodes from nodes carrying saved
state. `NodeCreatedEvent.loading` distinguishes workflow load from paste or
duplication.

## Cleanup and ownership

Registrations and subscriptions commonly return `Unsubscribe`:

```js
const cleanup = [
  comfy.defs.extend('KSampler', installDefinition),
  comfy.onWorkflowLoaded(rebuild),
  comfy.ui.addSidebarTab(tabDefinition)
]

function disposePack() {
  for (const stop of cleanup.splice(0)) stop()
}
```

Match cleanup to ownership:

- module registrations may live for the page;
- a sidebar tab or dialog releases listeners, observers, and timers from its
  `destroy` callback;
- a mounted widget releases them from `MountDef.destroy` or the function
  returned by a widget type's `render`;
- per-node state should be removed from `onRemoved`.

Do not attach private fields to a node handle. Keep pack-owned state in a map
keyed by graph ID and node ID, and release it with the node lifecycle.

## Type contract

Generate the complete declarations from the matching frontend revision:

```sh
node scripts/node-api/gen_api_dts.mjs > comfy-api.d.ts
```

If a type or member is absent from that file, it is not published. The runtime
global is not a substitute for missing declarations.
