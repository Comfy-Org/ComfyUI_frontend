# ADR-NODE-OUTPUTS-0059: Subgraph Node Outputs Are Kept Per Instance

Date: 2026-11-17

## Status

Accepted

## Context

Every instance of a subgraph definition shares one `Subgraph` object, and so
one `LGraphNode` per interior node. The backend still runs each instance on its
own path and reports results by execution ID: two hosts `5` and `6` of one
definition produce `executed` events for `5:10` and `6:10`.

`nodeOutputStore` keyed outputs and live preview URLs only by `NodeLocatorId`
(`<definition-uuid>:10`). Every write converted the execution ID to that
locator, so the last instance to run overwrote the others:

- an exposed preview on host `6` showed the image host `5` produced;
- an `executed` message with `merge: true` from one instance appended to
  another instance's images;
- when one instance's interior node started, the frontend revoked the live
  preview of every instance.

The by-execution-ID getters and the tests that covered them hid this: the
getters converted to the locator first, and the tests mocked that conversion
as the identity function.

A root node's execution ID equals its locator, so root nodes and root-level
subgraph hosts were already per instance. Only nodes inside subgraphs
collapsed.

## Decision

### Two maps

`nodeOutputStore` keeps its locator-keyed `nodeOutputs` and
`nodePreviewImages` unchanged, and adds two internal maps for nodes inside
subgraphs: per-instance outputs and per-instance live preview URLs, grouped by
locator and keyed by execution ID.

An execution ID is per instance when it **resolves** into a subgraph.
Counting colons is not enough: `insert_workflow` node IDs contain colons and
still sit at the root.

### Writes

- **From execution** (`executed`, `b_preview_with_metadata`, queue history
  load, change-tracker restore): write the locator entry as before, and for
  nodes inside subgraphs also the instance entry. `merge` and input-preview
  preservation apply to that instance's previous value.
- **From the node itself** (upload widget, mask editor, clipspace, widget
  select, GLSL and webcam previews): write the locator entry and clear that
  locator's instance entries. Interior widget values belong to the definition,
  so such a write applies to every instance.
- **Revoking** a live preview by execution ID affects only that instance. The
  release is delayed, and it releases only the frame that was current when it
  was scheduled: a newer frame for the same key, from another instance or from
  a workflow restored in the meantime, survives it.

### Reads

Reading by execution ID:

- a root ID reads the locator entry;
- an interior ID reads its instance entry;
- an interior ID with no instance entry reads the locator entry **only while
  no instance of that node has an entry**. An instance that has not run shows
  nothing; it never shows a sibling's result.

Readers that hold only a node object, such as `getNodeOutputs(node)`, the
canvas, and extensions, keep reading the locator entry, which is the last
writer for interior nodes.

### Lifecycle

- Removing a subgraph node from any graph, on screen or not, prunes the
  instance entries whose execution path no longer resolves and releases their
  blob URLs. The store listens for the `remove_node` graph intent. `LGraph.remove`
  emits it for every graph after the node has left the graph, so the pruning
  does not depend on a renderer.
- Removing a node's outputs, unpacking a subgraph, resetting, and stashing or
  restoring previews on a workflow switch cover both maps.
- `snapshotOutputs` returns the two maps as separate fields, `shared` and
  `instances`. The change tracker's `executed` listener writes later runs into
  both with the same rule as the store, so `restoreOutputs` copies the fields
  back without resolving keys or depending on their order. A locator and an
  execution ID can be the same string when a root node's ID equals a
  definition UUID, so the two never share a map, including the pending preview
  releases.

### Extension compatibility

`app.nodeOutputs`, `app.nodePreviewImages`, the `onNodeOutputsUpdated` payload,
`node.onExecuted`, and the node's canvas fields keep their keys and meaning.
The new maps are not reachable from extensions.

Every store write echoes back through the `app.nodeOutputs` mutation view, so
the legacy write path cannot tell an extension write from the store's own. It
therefore updates only the locator entry and never clears instance entries.

## Relation to ADR-WIDGET-COMPONENTS-0058

Widget components are durable data owned by a widget. On node removal,
`clearNodeOwnedStoreState` copies them into the node's detached metadata and
then clears the live copies, so undo and paste restore them.

Per-instance outputs are execution state, not widget components, and are not
registered with the component system. Removal follows the same order: the node
detaches, then its per-instance entries are cleared. Nothing is copied into
metadata. A host restored by undo or paste has not run, so it shows nothing
until it runs.

The clearing runs from the `remove_node` intent rather than from
`clearNodeOwnedStoreState`. That function runs before the node leaves its
graph, and `LGraph` imports it, so importing `nodeOutputStore` there creates an
import cycle through the workflow store.

## Relation to ADR-GRAPH-DOCUMENT-0026

ADR-GRAPH-DOCUMENT-0026 keys runtime state by document session uid,
`${uid}:${locator}`. The uid answers which document; this decision answers
which instance within a document. They compose: when the uid lands, both maps
move under it, giving `${uid}:${locator}` and `${uid}:${executionId}`.

## Alternatives considered

- **Execution-keyed only, locator derived.** Writes from the node itself have
  no execution ID, so this still needs a definition-level bucket, plus a
  derived `app.nodeOutputs` that the mutation view would write back into.
- **One map with both key kinds.** Every iterating reader, including
  extensions walking `app.nodeOutputs`, would have to skip execution keys.
- **A transient per-run overlay.** It would lose per-instance results on
  workflow switch and on history load.

## Consequences

- Exposed previews on subgraph nodes, both final outputs and live frames, show
  their own instance's results.
- One extra reference per interior output and one extra retain per interior
  live preview URL.
- Interior nodes viewed from inside a subgraph still show the last writer
  until the frontend knows which instance was opened.

## Open questions

1. **Instance context when entering a subgraph.** Showing interior nodes per
   instance needs the host the user entered from. PR #23291 tracks it. What to
   show when a subgraph is entered without a host (URL hash, reload) is
   undecided.
2. **Promoted per-host values on interior input previews**, such as a
   promoted `LoadImage.image`. The upload preview is written per node, so the
   interior preview shows one host's file. Undecided.
3. **Extension state set in `onExecuted`** (text previews, Load3D, audio)
   lives on the shared node object and shows the last instance that ran.
   Passing instance identity to extensions is undecided.
