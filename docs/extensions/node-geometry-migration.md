# Node Geometry Migration Notes

## Migration checklist

1. Keep using `node.pos`, `node.size`, `boundingRect`, `getBounding()`,
   `setPos()`, `setSize()`: no signature changes required.
2. Replace `repositionNodesVueMode()` calls with `applyNodePositions()`.
3. If you relied on `node.size` reflecting measured/rendered content, switch
   to `getBounding()` / `boundingRect`: `size` now strictly reflects the
   requested value.
4. Use the node/group geometry APIs, not the backing store; don't import
   `layoutStore` or depend on its internal format.
5. Writes through a removed reference update the detached object, not shared
   layout state.

## What changed

`LGraphNode.pos`, `size`, `boundingRect`, `getBounding()`, `setPos()`, and
`setSize()` keep the same signatures. These calls remain source-compatible.
Behavior changed in the three cases below.

```ts
node.pos = [100, 200]
node.pos[0] += 50
node.setSize([320, 200])
const box = node.getBounding()
```

Node and group geometry now lives in a shared layout store instead of
per-instance fields. Use the APIs above, not the store directly: it's an
internal implementation detail.

### `size` vs. rendered bounds

`node.size` is the size you requested, and what gets serialized.
`getBounding()` and `boundingRect` return the node's rendered bounds, which
can be larger than `size` when widget content forces the node to grow. Use
rendered bounds when you need the node's actual on-screen footprint.

```ts
// Before: a rendered-content resize could overwrite size, so collapsing a
// node and re-expanding it lost the original size.
node.size // could silently become the rendered footprint

// After: size always stays what you set; ask for rendered bounds explicitly.
node.size // the requested size, unchanged by rendering
node.getBounding() // the actual rendered bounds, may be larger
```

### `repositionNodesVueMode()` renamed to `applyNodePositions()`

```ts
// Before
canvas.repositionNodesVueMode(newPositions)
// After
canvas.applyNodePositions(newPositions)
```

`repositionNodesVueMode()` remains callable as a deprecated alias.

### Z-order is now unambiguous

Z-order used to come from two sources that could disagree: a node's position
in the node list, and its execution order. It's now always draw order. If
your extension inferred stacking or hit-test order from execution order,
switch to draw order.

## Writes through removed references stay local

After removal, geometry setters update only the detached node, group, or
reroute object. They do not update shared layout state or another entity that
now owns the same ID.
