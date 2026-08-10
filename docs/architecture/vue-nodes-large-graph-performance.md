# Vue nodes on large graphs

Vue node rendering was unusable on large workflows: every node in the graph
was mounted as a DOM component tree at all times, at every zoom level. A
3000-node workflow spent 310ms per frame while panning — roughly 3fps — where
the canvas renderer managed 27ms on the same graph.

This document records what was changed, what it bought, and what is left.

## Result

Median frame time while panning. "litegraph" is the canvas renderer as it was
before any of this work, and is the bar Vue nodes needed to clear.

| nodes | zoom | litegraph | vue before | vue after | vs litegraph | speedup |
| ----: | ---- | --------: | ---------: | --------: | -----------: | ------: |
|  1000 | 0.6  |   10.1 ms |    57.1 ms |   12.0 ms |        1.19x |    4.8x |
|  1000 | min  |   25.1 ms |    66.3 ms |   20.7 ms |        0.82x |    3.2x |
|  1000 | fit  |   37.2 ms |    81.4 ms |   34.2 ms |        0.92x |    2.4x |
|  3000 | 0.6  |   27.3 ms |   310.5 ms |   23.1 ms |        0.85x |   13.4x |
|  3000 | min  |   41.6 ms |   280.5 ms |   34.3 ms |        0.82x |    8.2x |
|  3000 | fit  |  126.5 ms |   380.7 ms |  104.0 ms |        0.82x |    3.7x |

Vue nodes now match or beat the original canvas-renderer baseline in five of
six configurations. DOM element counts on the 3000-node graph fell from 227,787
to 5,355 at working zoom and to 418 (application chrome only) when zoomed out.

`min` is the lowest zoom reachable by scrolling (0.1). `fit` is the zoom a
workflow opens at, which the loader picks to frame the whole graph and which
can be far below `min` — 0.0255 for the 3000-node graph.

## What changed

Each of these is a separate commit and can be reverted on its own.

### Minimap change detection

The minimap re-derived the entire graph every animation frame, and profiling a
pan showed roughly 62% of samples inside it — more than the node DOM. Its data
source ran a linear `find` over every node inside a loop over every node
(O(n²), ~9M comparisons per frame at 3000 nodes), serialised every link to
JSON to detect rewires, and rebuilt itself several times per render pass.

Change detection now uses an allocation-free rolling digest, the data source is
memoised per pass, node lookups go through the graph's own id index, and the
loop polls at 100ms rather than every frame. Structural edits already force a
redraw through event hooks; the loop only exists to catch drags and resizes,
which emit no event.

This is renderer-independent, so it made the canvas renderer faster too.

### Viewport culling

Only nodes intersecting an expanded viewport rect are mounted. Nodes mount as
soon as they enter and unmount after a short delay, so nodes oscillating on the
viewport edge do not thrash. Because that delay only elapses once panning
stops, a long continuous pan would otherwise accumulate everything it swept
over; an eager prune bounds the mounted set once it outgrows what is visible.

Two constraints shaped this:

- **The mounted set must not be a reactive dependency of the camera.**
  `TransformPane` deliberately writes its transform by direct DOM mutation to
  avoid re-diffing every node each frame; binding the node list to the camera
  would reintroduce exactly that cost. Camera state is sampled through a
  throttle instead.
- **Culling must unmount, never `display: none`.** The shared `ResizeObserver`
  has no zero-size guard, so a hidden node writes 0x0 bounds back through
  `layoutStore` into `liteNode.size` and corrupts the saved workflow.

Selected nodes are never culled, so unmounting cannot interrupt a drag or
resize in progress.

### Culling margin

The margin was a fraction of the viewport, which is screen-space, so dividing
it by the zoom made it cover more and more of the graph as the user zoomed out
— at minimum zoom it more than doubled the queried area and mounted 2012 of
3003 nodes. It is now capped in graph units, which leaves working zoom
untouched and only binds below roughly 0.35 zoom.

### Node culling index

A QuadTree of node bounds, rebuilt only when `layoutStore.layoutVersion`
changes, so panning over a static graph costs a tree query rather than a scan.

It deliberately does not reuse the shared `SpatialIndexManager`: that index is
built on `QUADTREE_CONFIG.DEFAULT_BOUNDS`, a fixed ±10000 box, and
`QuadTree.insert` silently drops anything not fully contained — its return
value is discarded, and `update()` cannot recover an item that was never
inserted. Real workflows outgrow that box, so most nodes would be missing from
query results. This index sizes its root to the graph's own extent.

### Level of detail

Below the zoom at which node text is legible, nodes are drawn as plain filled
rectangles on a canvas and no Vue components are mounted at all. This mirrors
what the canvas renderer has always done for its own low-quality pass, and uses
the same threshold (`min_font_size_for_lod`, adjusted for DPR) so both
renderers simplify at the same zoom.

The drawing lives in `renderer/core/canvas/nodeBoxRenderer.ts` — a pure
function over a 2D context and a set of bounds, with no graph or canvas
renderer dependencies — alongside `CanvasPathRenderer`, which already owns link
drawing. An earlier attempt drew these through the canvas renderer's own node
pass; that was reverted, because it left the DOM renderer unable to draw a
zoomed-out graph without litegraph present.

Link rendering waits for nodes to report slot positions measured from the DOM.
Simplified nodes have no slot elements, so on a graph large enough to open
below the threshold that measurement never arrived and links stayed hidden.
Crossing into the simplified mode now releases that wait, and links fall back
to positions derived from node bounds.

## Method

Graphs are built by stamping the default workflow across empty space in a grid,
which is how these workflows arise in practice. Each measurement loads a
workflow, moves to a fixed zoom, and records frame deltas from a rAF loop
driving a continuous pan, reporting the median and p95 of the stable portion.
Both renderers are measured in the same build, on the same workflow, with a
fresh page each.

Scripts live under `temp/scripts/` (untracked):

```bash
node temp/scripts/gen-big-graph.mjs 3000        # build a workflow
LABEL=my-run node temp/scripts/sweep.mjs        # measure both renderers
node temp/scripts/build-report.mjs              # render temp/perf-report.html
SCALE=0.0255 node temp/scripts/profile-pan.mjs temp/big-graph-3000.json
```

Caveat: one sample per configuration, with run-to-run variance measured at
roughly 10%. The large differences above are well clear of that; anything
inside ~15% should be treated as a tie.

## Known follow-ups

- **`renderLink` rebuilds its render context per link, per frame**, re-walking
  the link-type colour map and reallocating the highlighted-id set. Roughly 15%
  of frame time at fit zoom, and invisible at working zoom because culling
  means few links draw. It is in the shared link path, so fixing it helps both
  renderers. The fix is hoisting the context out of the per-link loop rather
  than caching it, since `LGraphCanvas.link_type_colors` is a static dictionary
  that extensions mutate in place.
- **The LOD threshold still reads the canvas renderer** for
  `min_font_size_for_lod` and `NODE_TEXT_SIZE`, and asks it to repaint when
  crossing. That keeps both renderers switching at the same zoom today; it can
  become a plain setting once the DOM renderer owns link drawing. The node
  boxes themselves have no such dependency.
- **Links are still drawn by the canvas renderer.** `CanvasPathRenderer` owns
  the drawing, but `drawConnections` decides which links to draw and computes
  their endpoints. This predates this work and is the remaining obstacle to the
  DOM renderer standing alone.
- **A fully zoomed-out large graph is slow in both renderers** — 104ms and
  113ms respectively at 3000 nodes. Most of that is browser layout, paint and
  compositing for what is on screen, not JavaScript, so it is not obviously
  fixable by either renderer.
