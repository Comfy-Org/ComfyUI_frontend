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

### Listening to a widget

12. `on(event, listener)` adds a listener to the widget object the handle
    reaches now. A listener belongs to that widget: it ends when the widget
    is removed, and a widget added again under the name, or rebuilt by undo,
    starts with none, as a chained callback does today. On a deleted widget
    `on` registers nothing and returns a disposer that does nothing. Every
    listener goes through the shared listener primitive, so one that throws
    is reported and the host's commit and the other listeners carry on.
13. `change` and `activate` hear the widget's `callback`, which every commit
    runs: the canvas's `setValue`, the Vue canvas, the side panel, and
    `setValue` here. The API chains it once per widget with the host's
    `useChainCallback`, after the callback that was there, as
    `useComputedWithWidgetWatch` does. `change` runs when the committed value
    differs from the one the last commit left, with copies of both;
    a value written without a commit, as a load restores it, is not a change.
    `activate` runs on every commit that `setValue` did not make, which is
    how a button is heard: its value never changes.
14. `removed` chains the widget's `onRemove`, which the host runs when it
    releases the widget: `removeWidget`, and for a DOM widget the removal of
    its node. It runs once.
15. `beforeSerialize` replaces the widget's `serializeValue`, the extension
    point `graphToPrompt` already awaits for each widget, with one that first
    awaits the serializer that was there, then lets listeners replace the
    value for this prompt only. The value a listener supplies is checked as
    `setValue` checks one. The event's `context` is always `'prompt'`; see
    "Core limitation".
16. Each bridge is installed when the first listener that needs it is added,
    and only then, so a widget no pack listens to is untouched. Nothing is
    added to `LGraphNode`, `BaseWidget` or `ExecutableNodeDTO`: `callback`,
    `onRemove` and `serializeValue` are members every widget already has,
    which host code assigns per widget in the same way (`dynamicPrompts`
    assigns `serializeValue`, `bindMultilineTextareaWidget` chains
    `onRemove`).

### Mounted and canvas widgets

17. `mount(def)` gives the pack an element on the node to fill with its own
    tools, its own Vue included, and nothing else of the host. It builds the
    widget as host code builds a DOM widget: a `DOMWidgetImpl` whose
    `serialize` is set first, added with `addWidget` from
    `src/scripts/domWidget.ts`, which registers it with the DOM widget store
    the canvases draw from. The value lives in the widget's `getValue` and
    `setValue` options, as for every DOM widget. `serialize` (the saved
    workflow) defaults to whether `defaultValue` is given, and `sendToPrompt`
    (the widget's `options.serialize`, which `graphToPrompt` reads) to
    `serialize`; a mount without a default is decoration and is neither saved
    nor sent. `height` fixes the height as `setHeight` does.
18. A mounted value is a string or a plain object or array. A DOM widget's
    value type is `object | string`, and the host reads a missing value as
    `''`, so `null` would not survive a save; a number or boolean is wrapped
    by the pack. `MountedValue.set` commits through `WidgetHandle.setValue`.
    `onChange` runs for every other write, such as a load restoring the
    value, and not for the pack's own `set`.
19. `render` is called once, when the widget is on its node; `destroy` is
    chained on the widget's `onRemove`, after the host's own cleanup, and the
    host runs it when the widget is removed and when its node is. Both are
    called through the shared listener primitive, so a throw is reported.
20. `canvas(def)` is a mount whose element holds a `<canvas>`. `draw` gets the
    context scaled for the device pixel ratio, the size in CSS pixels, the
    theme, and the value accessor when `defaultValue` is given. It runs on
    mount, when a `ResizeObserver` sees the container resize, on
    `redraw()`, and after every write of the value; nothing runs per frame.
    The theme is read from the design system's color tokens on each draw, so
    a theme switch needs nothing from the pack; a missing token falls back to
    `transparent` or `currentColor`. A primary-button press is captured and
    kept from the node under the widget; middle and right are left to the
    canvas's panning and menus. Positions are scaled back from the zoomed
    canvas to the units `draw` uses. The listeners and the observer are
    released with the widget.

### Declared widget types

21. A pack declares how every input of a type is shown with
    `comfy.defs.defineWidgetType(type, def)`, which returns a disposer. It
    registers a constructor with the host's widget store, the registry
    `getCustomWidgets` fills, so the host makes every input of that type a
    widget rather than a socket. It refuses a type the host or another pack
    already defines. The widget store gains
    `unregisterCustomWidget(type, constructor)`, which removes the type only
    if that constructor still holds it, so the disposer removes only its own
    registration. This settles what
    [ADR-EXTENSIONS-NODE-API-0071](EXTENSIONS-NODE-API-0071-node-definitions-and-hooks.md)
    decision 39 left to this feature for `defineWidgetType`.
22. The constructor builds the same DOM widget as `mount`, while the node is
    being created, and calls `render` with the element, the value accessor,
    the input's name and a context whose `getOptions()` copies the options
    the input was declared with. The value starts from the declaration's
    `default` when it is text, else the type's `defaultValue`, else `''`.
    `set` commits through the same edit as `setValue`; while the node is
    still being made, and so in no graph, it writes the value without an
    undo step. A teardown `render`
    returns runs when the host releases the widget. `serialize` (saved and
    sent) defaults to `true`; `minHeight` is returned to the host, which
    sizes the node with it; `height` fixes the height.

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
- Hear values through the graph intents the widget value store emits. They
  carry the root graph id, not the widget, and they also fire while a load
  or an undo restores values, when a pack reacting with an edit would fight
  the restore.
- Keep listeners on the handle, so they survive undo. Packs register in
  `onCreated`, which runs again for every node an undo rebuilds, and would
  then hear each change twice.
- Install `beforeSerialize` for the saved workflow through the node's
  `onSerialize`. That is API behaviour on `LGraphNode`; see "Core
  limitation".
- Take a Vue component from the pack and render it with the host's Vue. A
  pack is trusted code with its own tools; the host hands it an element.

## Members left out

- `WidgetHandle.getHeight`, `MountDef.hidden`, `CanvasDef.onContextMenu`:
  no stored pack uses them.
- `WidgetTypeDef.minWidth` (no stored pack uses it), and
  `WidgetTypeContext.onNodeReady` (1 pack, 4 sites): it needs to hear a node
  join and leave a graph, which is the node lifecycle hooks of the node
  definitions feature, or a hook on the `LGraphNode` instance this API does
  not install.
- A number, boolean or `null` as a mounted value: 2 sites in the stored
  packs use one (`0` and `null` as `defaultValue`); see decision 18.
- `WidgetTextEventBase.menuEvent`, `WidgetTextKeyEvent.altKey` and `repeat`,
  and `WidgetTextWheelEvent.deltaY`, `ctrlKey` and `preventDefault`: no
  stored pack uses them.

Not built yet, and not part of this feature until they are:

- The text-editor events (`on('textInteraction')`, 2 packs, 2 sites). On the
  litegraph canvas a multiline widget's `<textarea>` is the DOM widget's
  element, but the Vue canvas renders its own in `WidgetTextarea.vue`, which
  the API cannot reach without a call added to that component. Shipping the
  events for one renderer would publish a member that silently does nothing
  on the other.

## Core limitation

The old contract also offered `beforeSerialize` with `context` `'workflow'`
(the saved file) and `'embedded'` (the copy written into an output image).
Of the 15 stored packs that listen, 7 replace the saved value. The host has
no seam for that: `LGraphNode.serialize` reads `widget.value` directly in
`serialiseWidgetValues`, and the only hook after it is the node's
`onSerialize`, on `LGraphNode`. Until a seam exists, those packs' saved files
keep the widget's own value. The ticket to file:

- **Title:** Let a widget supply the value saved in the workflow.
- **Reproduction:** give a widget a `serializeValue` that returns another
  value, save the workflow, and read `widgets_values`: it holds
  `widget.value`, not what `serializeValue` returned. The same holds for the
  workflow embedded in a queued prompt's `extra_pnginfo`.
- **Suggested direction:** an optional widget member, for example
  `serializeWorkflowValue(context)`, read by `serialiseWidgetValues` in
  `LGraphNode.ts`, with the context telling a saved file from the copy
  `graphToPrompt` embeds. When it lands, `context` gains `'workflow'` and
  `'embedded'` as a patch.

## Consequences

Changes outside the folder: `NodeHandle` gains `widgets` through the node
handle members seam (`createNodeHandles(handles, membersFor)`), and the edit
core's `nodeHandleMembers` returns every member but `widgets`. Widget values
and options are copied with `shared/savedCopy.ts`, as properties are.
`DefRegistry` gains `defineWidgetType` (decision 21), and `useWidgetStore`
gains `unregisterCustomWidget`.

`createListeners` in `shared/listeners.ts` takes the arguments an event
carries as a type parameter and passes them to each listener through
`callListener`, so a widget's listeners share the one isolation path with
`onReady` and the node type hooks; `render`, `destroy`, `draw` and pointer
handlers are called through `callListener` too. The definitions registry now calls
`onRefreshed` listeners with no arguments, so the arguments the host passes
its extension hook do not reach a pack.

## What this feature replaces or duplicates, and why

- **The savable-value check.** `savableValue.ts` walks a value to refuse what
  the workflow cannot save. `JSON.stringify` silently drops a function or
  turns `NaN` into `null`, which would hide the mistake; `isPlainObject` from
  `es-toolkit` is used for the object test.
- **Chaining a callback.** `useChainCallback` from the host is used for the
  `callback` and `onRemove` bridges. It has no error isolation, so the
  listeners it calls are delivered through the shared primitive.
- **A DOM widget.** `mount` builds its widget with the host's
  `DOMWidgetImpl` and `addWidget`, as `useProgressTextWidget` does, rather
  than `LGraphNode.addDOMWidget`, which cannot set `serialize` before the
  widget is added and so would give it a value meant for another widget when
  a workflow restores.
- **Theme colors.** `canvas` reads the design system's `--color-*` tokens
  from the element's computed style. Nothing in the repository gives a
  canvas these colors by intent; `LiteGraph`'s widget color constants
  follow the litegraph palette, not the design system.
- **The definition check.** `definitionFields.ts` refuses unknown fields as
  `queryNodes` does, for every widget definition in this feature.
