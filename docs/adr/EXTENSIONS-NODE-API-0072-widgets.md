# ADR-EXTENSIONS-NODE-API-0072: Widgets in the V4 node API

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
gives packs node handles that read a node. Most packs also read and change the
node's widgets: 101 of the 125 stored packs that import the API reach
`node.widgets`, at 883 sites. Today they do it through `LGraphNode.widgets`,
assigning `widget.value` and calling `widget.callback`, splicing the array,
and chaining `widget.callback` to hear a change. Each of those bypasses part of
what the host does on a user's edit, or drops another pack's listener.

The host already owns widgets in several places:

- `LGraphNode.widgets` is a view that turns every widget into a `BaseWidget`
  and keeps the widget value store's order in step with any change to the
  array.
- `BaseWidget.setValue` is the canvas's commit: it writes the value, writes a
  bound node property, runs the widget's callback and the node's
  `onWidgetChanged`, and advances the graph version.
- `useWidgetValueStore` holds each widget's value, label, options and
  visibility, which the Vue canvas renders from.
- The change tracker records an undo step when a change ends, and marks the
  workflow modified.

This ADR records how the API reaches widgets through those owners.

## Decision

### Reading and changing widgets

1. `NodeHandle.widgets` is a collection created once per node handle. Every
   read goes to the live node. On a deleted or retired node every read is
   `undefined`, iteration yields nothing, and every change does nothing, as
   for the node handle.
2. A widget handle names a widget by its node and its name, the identity the
   widget value store uses. It comes from the shared handle cache of ADR-EXTENSIONS-NODE-API-0070,
   keyed by node id and name in the node's graph, so there is one handle per
   widget, it belongs to its node's graph and document, it is retired by
   `beginDocument()`, and `afterHistoryRestore()` retires it if its widget is
   gone. A widget removed and added again under its name before any undo or
   redo finishes is reached by the same handle. A handle reaches only a
   `BaseWidget` in `node.widgets`; the widgets view makes every widget one,
   except a widget whose name cannot be read.
3. `getValue()` returns the value copied as the workflow saves it, frozen;
   a widget with no value reads as `null`, and a value the workflow cannot
   save reads as `undefined` and is reported once per member, as
   `getProperty` does. `getOptions()` is the same copy of the options, so an
   option that is a function is left out.
4. `setValue(value)` accepts what the workflow can save: a string, a finite
   number, a boolean, `null`, or a plain object or array of those. It copies
   the value and commits it through `BaseWidget.setValue`, the canvas's own
   commit, so the value, a bound property, the widget's callback, the node's
   `onWidgetChanged` and the graph version all move as on a user's edit.
5. A change the workflow saves (a value, an added or removed widget, a new
   order) is applied through the edit runner of
   [ADR-EXTENSIONS-NODE-API-0073](EXTENSIONS-NODE-API-0073-functional-edit-core.md),
   over the `history` service it uses: one undo step of the open workflow,
   then a new graph version and a redraw. A change made while another is
   open, such as inside `comfy.edit.batch` or a listener reacting to an
   edit, joins it. A change the workflow does not save (label, option,
   hidden, disabled, height, links) is not recorded, as it would compare
   equal and add nothing, and only asks the node's canvas to redraw.
6. `setOption(key, value)` writes through the widget's options object, whose
   shim applies `hidden`, `hideInPanel`, `canvasOnly` and `advanced` to the
   widget's visibility. It refuses `__proto__`, `constructor`, `prototype` and
   an empty key, and a value the workflow cannot save.
7. `setHidden` hides or shows the widget and every widget linked to it, each
   once, as the legacy `hideWidget` helper did, so a seed's
   `control_after_generate` follows the seed.
8. `setHeight(height)` sets the widget's `computeSize`, which the node's
   layout reads before anything else, and grows the node to fit with
   `expandToFitContent()`.
9. `add(def)` adds a widget with `addCustomWidget` from a copy of the
   definition, with `serialize`, `disabled` and `hidden` on it before it is
   added, so the host counts its saved slot correctly when it restores values.
   It refuses a definition with a field it does not know, a name the node
   already has, and a combo without `options.values`, which the host's
   `addWidget` also refuses.
10. `remove(name)` uses `LGraphNode.removeWidget`. `reorder(names)` and
    `move(name, index)` splice `node.widgets`, whose view updates the order
    the Vue canvas draws from. `reorder` needs every name once; `move`
    clamps the index to the list.
11. Every argument is checked before anything is read or changed, and refused
    with the `TypeError` of ADR-EXTENSIONS-NODE-API-0070 decision 13. The checks run on a deleted
    widget too.

## Alternatives considered

- Write a value with `useWidgetValueStore().setValue` and call the callback,
  as the Vue canvas does. That path does not write a bound property, run
  `onWidgetChanged`, or advance the graph version; the canvas path does all
  of them.
- Record every change with `captureCanvasState()`. Each call adds an undo
  step, so a pack that sets three widgets in a listener for one edit would
  need three undos. The tracker's change transaction groups them.
- Reorder by replacing the store's widget order. The widgets view already
  keeps the store in step with the array, and a second writer would drift.
- Accept any value, as `widget.value` does. A value the workflow cannot save
  is lost on the next save or undo; refusing it shows the pack's mistake at
  the call.

## Consequences

Changes outside the folder: `NodeHandle` gains `widgets` through the node
handle members seam (`createNodeHandles(handles, membersFor)`), and the edit
core's `nodeHandleMembers` returns every member but `widgets`. Widget values
and options are copied with `shared/savedCopy.ts`, as properties are.

## What this feature replaces or duplicates, and why

- **The savable-value check.** `savableValue.ts` walks a value to refuse what
  the workflow cannot save. `JSON.stringify` silently drops a function or
  turns `NaN` into `null`, which would hide the mistake; `isPlainObject` from
  `es-toolkit` is used for the object test.
- **The definition check.** `definitionFields.ts` refuses unknown fields as
  `queryNodes` does, for every widget definition in this feature.
