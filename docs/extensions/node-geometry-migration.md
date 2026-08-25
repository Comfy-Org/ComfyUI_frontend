# Node Geometry Migration Notes

`LGraphNode.pos`, `size`, `boundingRect`, `getBounding()`, `setPos()`, and
`setSize()` remain the supported node geometry facade. The API shape is
unchanged; only the backing storage moved.

```ts
node.pos = [100, 200]
node.pos[0] += 50
node.setSize([320, 200])
const box = node.getBounding()
```

All four calls above continue to work exactly as before.

## Backing store

Durable node (and now group) geometry lives in a single Yjs-backed
`layoutStore`, replacing the previous mix of per-class fields, mode-specific
helpers, and a bulk graph-to-store resync that could disagree with each other
(#14110). `node.pos` and `node.size` are Proxy-backed "mutation views" over
that store: every read re-synchronizes from the current store revision first,
and every write — whole-array assignment, an indexed write like
`node.pos[0] = x`, or an in-place array method — commits back through the
store. Extensions should keep using the node/group geometry facade and must
not import or depend on `layoutStore` or its scoped-key format; it is a
private implementation detail (see
[ECS extension compatibility audit](../architecture/ecs/ecs-extension-compatibility-audit.md#geometry-facade)).

## Registration lifecycle moved to attach/detach

Node layout registration used to be created by the Vue renderer
(`useVueNodeLifecycle`, listening for `node:added`/`node:removed`), so an entry
could outlive the graph that created it while the renderer was off. It now
registers inside `LGraph.add` and deregisters inside `LGraph.remove`, beside
the node's other store registrations (#14128). No extension-facing signature
changed, but one visible consequence follows: z-order is now unambiguous.
Previously `zIndex` was seeded two different ways (position in the `_nodes`
array vs. execution order from `computeExecutionOrder`) that could disagree;
draw order is now the single source extensions will observe through stacking
and hit-testing.

## Requested size vs. rendered size

`node.size` is the size you (or the user) requested, and is what gets
serialized. It is no longer overwritten by DOM measurements of Vue-rendered
content (#14758) — previously, a resize driven by a node's actual rendered
content (widgets, dynamic content) could leak back into the saved `size`, so,
for example, collapsing a node could clobber its expanded size. If you need
the node's actual on-screen footprint — which can be larger than the
requested `size` when content forces the node to grow — read `getBounding()`
/ `boundingRect`, not `size`; both already account for render-time content
size internally (`renderingSize`).

## Batch reposition API renamed

`LGraphCanvas.repositionNodesVueMode(positions)` is deprecated in favor of
`LGraphCanvas.applyNodePositions(positions)` (same `NewNodePosition[]`
signature; the new implementation is a loop over `node.setPos()`). The old
name remains callable, forwards to the new one, and logs a deprecation
warning.

```ts
// Before
canvas.repositionNodesVueMode(newPositions)
// After
canvas.applyNodePositions(newPositions)
```

## Bounding-box timing is unchanged

`boundingRect` / `renderArea` are still computed once per frame in
`updateArea()` (via `measure()` and the `onBounding` hook), not recalculated
on every read. This was not touched by the ECS work — `getBounding()` returns
the same per-frame cached rectangle it always did.

## Stale-instance safety

Layout registrations are now tied to the specific `LGraphNode` / `LGraphGroup`
/ `Reroute` *instance* that attached them, not just to an ID (#15017). If an
extension holds on to a node reference after it has been removed from the
graph — a detached clone, or a stale reference captured before an async
callback resolves — calling `setPos()` / `setSize()` on it is now a safe
no-op instead of silently mutating whatever entity now owns that ID. (An
earlier attempt at this, #14480, shipped speculative multiplayer
retry/compensation machinery for a CRDT transport that doesn't exist yet; that
revision was closed unmerged and the simpler ownership check landed via
#15017 instead.)

## What did not change

- `LGraphGroup` gained the identical `pos` / `size` / `boundingRect` facade,
  backed by the same store, so group geometry code needs no changes beyond
  what's described above.
- Geometry reads/writes are not gated behind an active Pinia instance the way
  link topology is (see
  [Link registration migration](./link-registration-migration.md)):
  `layoutStore` is a plain module singleton, independent of Pinia.

## Migration checklist

1. Keep using `node.pos`, `node.size`, `boundingRect`, `getBounding()`,
   `setPos()`, `setSize()` — no signature changes required.
2. Replace `repositionNodesVueMode()` calls with `applyNodePositions()`.
3. If you were relying on `node.size` reflecting measured/rendered content,
   switch to `getBounding()` / `boundingRect` — `size` now strictly reflects
   the requested value.
4. Do not import `layoutStore` or depend on its scoped-key format; use the
   node/group geometry facade instead.
5. Do not assume a synchronous error on a stale-instance geometry write; it
   now silently no-ops rather than throwing or clobbering live geometry.
