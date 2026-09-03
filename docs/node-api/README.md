# Published custom-node API

The published custom-node API is the supported JavaScript surface for extending
ComfyUI nodes and the editor without depending on LiteGraph, renderer, store,
DOM, or application internals.

```js
import { comfy } from '/comfy/api/v2.js'

comfy.defs.extend('KSampler', (definition) => {
  definition.addMenuItem({
    label: 'Reset seed',
    run(node) {
      node.widgets.get('seed')?.setValue(0)
    }
  })
})
```

The module path is `/comfy/api/v2.js`; the API contract currently reports
`comfy.version === '2.0'`. The path identifies the published module generation,
while `comfy.version` versions the contract exposed by that module.

## Why this API exists

Legacy extensions receive live frontend objects and commonly patch prototypes,
mutate arrays, paint into the shared canvas, inspect application globals, and
reach into Pinia stores. Those techniques bind a pack to one renderer and one
internal data model. They also make ordinary frontend refactors ecosystem-wide
breaking changes.

The published API exposes intent instead:

- definition hooks instead of constructor and prototype patches;
- ID-backed handles instead of live entity objects;
- collections and frozen snapshots instead of mutable arrays;
- graph and slot operations instead of editing link records;
- mounted or host-rendered UI instead of host DOM selectors;
- capability probing instead of frontend-version guesses.

The goal is functional migration, not a spelling change. If a pack used an
internal mechanism for a feature the API supports another way, use the supported
mechanism and preserve the feature.

## Start here

1. [Key concepts](./concepts.md) explains handles, snapshots, graph scopes,
   lifecycle, mutation, and serialization.
2. [Tutorial](./tutorial.md) builds a small extension around an existing backend
   node.
3. [Migration how-to](./how-to.md) maps common LiteGraph and legacy `app`
   mechanisms to behavior-preserving published API replacements.
4. [Registration and lifecycle](./registration.md) covers module loading,
   capability probing, definition registration, globals, and teardown.

## Guides

| Guide                                      | Covers                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [Migration how-to](./how-to.md)            | task-oriented LiteGraph-to-API recipes, intent forks, before/after examples, and migration traps                     |
| [Nodes and definitions](./nodes.md)        | `NodeDef`, `NodeDefBuilder`, `NodeHandle`, lifecycle hooks, properties, menus, badges, and frontend node definitions |
| [Graphs and groups](./graph.md)            | visible/root/subgraph scopes, selection, geometry, editing, undo batches, groups, and graph events                   |
| [Slots and links](./slots.md)              | slot identity, lookup, dynamic slots, connections, link-preserving operations, and resolved sources                  |
| [Widgets](./widgets.md)                    | widget values, events, ordering, serialization, DOM mounts, canvas widgets, and custom widget types                  |
| [Execution and resolution](./execution.md) | queue lifecycle, backend execution, frontend-only nodes, suppliers, preview frames, and prompt-time serialization    |
| [Application services](./services.md)      | settings, commands, notifications, UI contributions, backend requests, workflow loading, and persistent storage      |
| [API reference](./reference.md)            | root members, domain interfaces, capability names, errors, and the generated declaration contract                    |

## The root object

`comfy` is installed before custom-node modules are evaluated. Its main domains
are:

| Member           | Responsibility                                                 |
| ---------------- | -------------------------------------------------------------- |
| `comfy.defs`     | Read, extend, and define node and widget types.                |
| `comfy.graph`    | Work with the graph currently shown by the editor.             |
| `comfy.queue`    | Submit, guard, observe, and interrupt runs.                    |
| `comfy.settings` | Declare and observe preferences.                               |
| `comfy.storage`  | Store per-user pack documents and presets.                     |
| `comfy.ui`       | Contribute tabs, badges, buttons, dialogs, menus, and prompts. |
| `comfy.commands` | Register and run commands, keybindings, and notifications.     |
| `comfy.backend`  | Build URLs, make authenticated requests, and receive events.   |
| `comfy.workflow` | Open workflow data and apply host text replacements.           |

Root lifecycle and observation methods cover application readiness, workflow
loads, viewport changes, node changes and movement, editor interaction state,
and the currently executing node.

## Stability and capabilities

The contract uses `major.minor` versioning:

- a major change removes or changes existing behavior;
- a minor change only adds behavior;
- every supported major remains available through `comfy.forMajor(major)`.

Branch on capabilities, not version strings:

```js
if (comfy.supports('widgets.canvas')) {
  installCanvasWidget()
}

comfy.require('slots.connectedType')
```

`supports()` is cheap and never throws. `require()` throws an actionable
`ComfyUnsupportedError`. `comfy.capabilities()` returns the complete capability
set provided by the current host.

## Contract boundary

The following are deliberately not part of the published surface:

- `app`, `ComfyApp`, `window.comfyAPI`, and `/scripts/app.js`;
- `LiteGraph`, `LGraph`, `LGraphNode`, `LGraphCanvas`, and their prototypes;
- Pinia stores and renderer-owned DOM elements;
- mutable link objects and internal node, widget, slot, or group arrays;
- constructors or class inheritance for entity modeling;
- global CSS selectors that restyle host-owned markup.

If the API lacks a user capability, document the capability rather than
reintroducing an internal escape hatch. If the capability already exists through
a different domain, use that domain.

## Authoritative contract

The exact TypeScript surface is generated from `src/platform/nodeApi/`:

```sh
node scripts/node-api/gen_api_dts.mjs > comfy-api.d.ts
```

The generated declaration file is the compiler contract. These guides explain
how and why to use it; [the reference](./reference.md) provides a navigable map.
If prose and generated types ever disagree, treat the generated types and their
implementation tests as authoritative and fix the prose.
