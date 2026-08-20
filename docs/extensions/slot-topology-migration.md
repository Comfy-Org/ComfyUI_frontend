# Slot Topology Migration

`linkStore` owns live graph connectivity. The legacy `input.link` and
`output.links` properties are read-only projections: writes warn and have no
effect, and `output.links` returns a frozen snapshot.

## API mapping

| Legacy operation                        | Replacement                                                    |
| --------------------------------------- | -------------------------------------------------------------- |
| `node.inputs[slot].link = null`         | `node.disconnectInput(slot)`                                   |
| `node.outputs[slot].links = []`         | `node.disconnectOutput(slot)`                                  |
| `node.outputs[slot].links.length = 0`   | `node.disconnectOutput(slot)`                                  |
| `node.outputs[slot].links.push(linkId)` | `node.connect(slot, targetNode, targetSlot)`                   |
| Remove every output link                | `node.disconnectOutput(slot)`                                  |
| Remove links to one target              | `node.disconnectOutput(slot, targetNode)`                      |
| Read the input link                     | `node.getInputLink(slot)`                                      |
| Check connectivity                      | `node.isInputConnected(slot)` / `node.isOutputConnected(slot)` |
| Enumerate output links                  | `outputLinks(node.graph, node.id, slot)`                       |

Import `outputLinks` from the public app module:

```ts
import { outputLinks } from '../../scripts/app.js'

if (!node.graph) return
for (const link of outputLinks(node.graph, node.id, outputSlot)) {
  const target = node.graph.getNodeById(link.target_id)
  // Use link.target_slot and target as needed.
}
```

`outputLinks()` returns link objects, not the link IDs exposed by the legacy
mirror. Use `link.id` when an ID is required.

Do not translate a link ID push into a direct store insertion. `connect()`
coordinates input replacement, reroutes, graph versioning, veto hooks, and
`onConnectionsChange` callbacks. Likewise, use `disconnectInput()` or
`disconnectOutput()` instead of deleting IDs from a mirror array.

## Tests and fixtures

Tests should build a real graph and use the same topology APIs as production:

```ts
graph.add(source)
graph.add(target)
source.connect(sourceSlot, target, targetSlot)

target.disconnectInput(targetSlot)
source.disconnectOutput(sourceSlot)
```

Avoid mocks that simulate `connect()` by assigning `input.link`. Such mocks no
longer model application behavior and can pass while production connectivity
is unchanged.
