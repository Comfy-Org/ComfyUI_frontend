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
   `endDocument()` and `beginDocument()`, and `afterHistoryRestore()` retires
   it if its widget is gone, or if the restore lacked its node and another
   node took the node's id (`beforeHistoryRestore`,
   ADR-EXTENSIONS-NODE-API-0070 decision 10). A widget removed and added
   again under its name before any undo or redo finishes is reached by the
   same handle. A handle reaches only a
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
5. A change to a value, and a widget added, removed or moved (`add`,
   `remove`, `reorder`, `move`), is applied through the edit runner of
   [ADR-EXTENSIONS-NODE-API-0073](EXTENSIONS-NODE-API-0073-functional-edit-core.md),
   over the `history` service it uses: one undo step of the open workflow,
   then a new graph version and a redraw. A change made while another is
   open, such as inside `comfy.graph.batch` or a listener reacting to an
   edit, joins it. `setHeight` (decision 8) is such a change too, because
   the node it grows is saved. A change the workflow does not save (label,
   option, hidden, disabled, links) is not recorded, as it would compare
   equal and add nothing, and only asks the node's canvas to redraw.
   - The workflow saves a node's widget values, not its widgets. An undo of
     the step gives back the state before it. A redo, the undo of any later
     step and a reload rebuild the node from its saved state: the host
     makes the node from its type (and its `onCreated` hooks, which run
     before the values are restored), then `LGraphNode.configure` restores
     `widgets_values` onto the widgets it made. So a widget added, removed
     or moved by these members after the node was made is not given back:
     the node has the type's widgets in the type's order again.
   - Which values those widgets get depends on the host's experimental
     setting `Comfy.Workflow.NamedValuesRestore` (`LiteGraph.namedValuesRestore`),
     off by default. Off, the values are restored by position, so after a
     `reorder` or `move` each widget gets the value of the one saved in its
     place, and after a `remove` each later widget gets the value of the
     one after it and the last its default: the values land on the wrong
     widgets, are saved so, and are sent in the prompt. On, each value is
     restored by name from `widgets_values_named`, which the host writes on
     every save, so the values stay with their widgets and a removed widget
     comes back at its default. An `add`ed widget is dropped either way.
   - The same change made in `onCreated` is safe, because it runs again for
     every rebuilt node before the values are restored; the stored packs
     that reshape a node mostly do it there. Whether the API should refuse
     these members after `onCreated`, or turn on named restore, is open.
     `app.test.ts` ("a widget change made after the node is, rebuilt from
     the saved state") records, through the real change tracker and with
     the setting off and on, what the change, its undo, its redo, a later
     undo and a reload leave, for each of the four members.
6. `setOption(key, value)` writes through the widget's options object, whose
   shim applies `hidden`, `hideInPanel`, `canvasOnly` and `advanced` to the
   widget's visibility. It refuses a key `isStoreKey` refuses (empty, or an
   `Object.prototype` member such as `__proto__`, `constructor` or
   `toString`), and a value the workflow cannot save. `prototype` is not
   inherited by a plain object, so it is an ordinary key and is accepted.
7. `setHidden` hides or shows the widget and every widget linked to it, each
   once, as the legacy `hideWidget` helper did, so a seed's
   `control_after_generate` follows the seed.
8. `setHeight(height)` sets the widget's `computeSize`, which the
   litegraph canvas's node layout reads before anything else, and grows the
   node to fit with `expandToFitContent()`.
   - Vue nodes read it too, since #23428 (17 Nov): `WidgetGrid.vue` sizes
     each row from the shared `getWidgetSizing`, which gives a widget with a
     `computeSize` a fixed row (`flex-none`, `min-height` of that height),
     and a DOM widget without one a growing row that shares the free
     height. So in both renderers a widget given a height keeps it and the
     others share what is left; under Vue nodes the height is the row's
     least, so content taller than it makes the row taller. An earlier text
     of this decision, and the JSDoc of `setHeight`, `MountDef.height`,
     `CanvasDef.height` and `WidgetTypeDef.height`, said Vue nodes shared the
     free height whatever the height, which #23428 made untrue; the renderer
     tests (`LGraphNode.nodeApi.test.ts` under Vue nodes,
     `widgetCollection.test.ts` on the canvas) caught it, and the JSDoc now
     makes the claim for both renderers.
9. `add(def)` adds a widget with `addCustomWidget` from a copy of the
   definition, its type in lower case as the host's `addWidget` makes it (so
   `'COMBO'` is a combo and is checked as one), with `serialize`,
   `disabled` and `hidden` on it before it is
   added, so the host counts its saved slot correctly when it restores values.
   It refuses a definition with a field it does not know, a name the node
   already has, and a combo without `options.values`, which the host's
   `addWidget` also refuses.

   A widget's name may be empty, as V2 allowed. The host keeps such a widget:
   it is in `node.widgets`, drawn on the litegraph canvas, saved in
   `widgets_values` and reached by `widgets.get('')`. The widget value store
   cannot key it (`registerWidget` warns "ignoring un-keyable widget id"),
   so the Vue canvas, which draws from that store, does not show it. A
   `mount`, `canvas` or declared type still needs a name: no stored pack
   gives one an empty name, and its element would not show on the Vue
   canvas.

   A combo's `options.values` may be a function, as the host's combo allows
   (`ComboWidget` and `WidgetSelectDefault` call it each time they read the
   list). The API stores a function that calls the pack's with no
   arguments, since the host passes it the widget and the node; a throw, or
   a result that is not a list of text or finite numbers, is reported and
   reads as an empty list. A getter of `values` is the same computed list:
   the API calls it on the pack's options object each time the host reads
   the list, as the host's combo would have read it. The stored kjnodes Get
   node (1 pack, 1 site) gives its choices so, and V2 handed the options to
   the host unchanged; refusing the getter, as the savable-value check
   refuses any other (decision 11), left that node with no widget. Any
   other function in a definition's options is refused. `getOptions()`
   leaves the function or getter out (decision 3).

10. `remove(name)` uses `LGraphNode.removeWidget`. `reorder(names)` and
    `move(name, index)` splice `node.widgets`, whose view updates the order
    the Vue canvas draws from. `reorder` needs every name once; `move`
    takes an index of zero or more and clamps it to the end of the list (a
    negative index would read as counting back, as `at` does, so it is
    refused). As every edit in the API does, each change
    a widget handle or collection makes returns `true` when it is applied and
    `false` when its widget or node is gone, and `move` of a name the node
    lacks is `false`, as `remove` is.
11. Every argument is checked before anything is read or changed, and refused
    with the `TypeError` of ADR-EXTENSIONS-NODE-API-0070 decision 13. The checks run on a deleted
    widget too. A refusal of a value the workflow cannot save names the part
    it cannot save and what it found there, as `options.format` or
    `value.list[0]`, not the whole argument. A property with a getter is
    refused without calling it: the check and the copy would each call it,
    and could get different values.

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
    differs (`Object.is`) from the one the last commit left, with copies of
    both, so a value another writer set without a commit is not compared,
    and two equal objects are two values. `activate` runs on every commit
    that `setValue` did not make, which is how a button is heard: its value
    never changes.
    - A value a load writes is not a change. On most widgets the restore
      assigns `widget.value`, which runs no callback. A DOM widget's `value`
      setter (`BaseDOMWidgetImpl` in `src/scripts/domWidget.ts`) runs
      `callback` itself, so `LGraphNode.configure` restoring a mount, a
      canvas, a declared type or a text area runs it. The callback is the
      host's; what it means to a pack is the API's bridge. So the bridge
      reports neither event while the host is loading or restoring a graph,
      by the change tracker's own test for a write that is not a user's
      change: the graph on screen loading (`isGraphLoading`, set by every
      `loadGraphData` into it: a load, a switch to a tab whose graph is not
      live, an undo or redo) or `isChangeCaptureSuppressed()` (the API JSON
      and A1111 imports). It still records the value, so the first
      commit after the load is compared with what the load left. The window
      is the tracker's, not just `configure`: it includes the
      `loadedGraphNode`, `afterConfigureGraph` and `afterLoadGraph` hooks,
      whose writes the tracker also records as part of the load and not as
      an undo step, and an undo's or redo's `onWorkflowLoaded` listeners. A
      load's listeners run once it has ended (ADR-EXTENSIONS-NODE-API-0075
      decision 13): a commit there is heard, and is an undo step. A pack
      reads values in `onWorkflowLoaded`. A paste or
      a duplicate configures a new node outside that window, and a DOM
      widget's listeners hear the pasted value as a change. `app.test.ts`
      drives a load, an undo and an import's suppression through the real
      host and `widgetEvents.test.ts` the rule.
    - A commit on a DOM widget runs `activate` twice. `BaseWidget.setValue`,
      the Vue canvas's update handler and the text area's input handler each
      assign `value`, whose setter runs `callback`, and then call `callback`
      again. The second call is the host's, and the bridge reports each call
      the host makes: telling them apart would mean wrapping the setter. The
      `activate` JSDoc says so, `app.test.ts` pins it, and the ticket is
      under "Core limitation". `change` runs once, as the second call leaves
      the value as the first did.
14. `removed` chains the widget's `onRemove`, which the host runs when it
    releases the widget: `removeWidget`, and for a DOM widget the removal of
    its node. It runs once.
15. `beforeSerialize` replaces the widget's `serializeValue`, the extension
    point `graphToPrompt` already awaits for each widget, with one that first
    awaits the serializer that was there, then lets listeners replace the
    value for this prompt only. `app.graphToPrompt` builds a prompt to queue,
    and also for Export and Export (API) and for the share dialog's asset
    list (ADR-EXTENSIONS-NODE-API-0076 decision 2), so a listener runs for
    each, and in an Export (API) file the replaced value is what is written.
    The value a listener supplies is checked as `setValue` checks one. The
    event's `context` is always `'prompt'`; see "Core limitation".
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
    nor sent. `height` fixes the height as `setHeight` does, in both
    renderers (decision 8).
18. A mounted value is any value the workflow can save, as `setValue` takes
    one (decision 4), so a pack holds a number or a boolean as it is. The
    host's DOM widget reads its value through `options.getValue` and
    replaces only a missing one with `''` (`readDomWidgetValue` in
    `src/scripts/domWidget.ts`): a number or a boolean is held, saved,
    restored and sent unchanged, and `DOMWidgetValue` in
    `src/types/domWidget.ts` now types it so. `null` is the one value the
    host cannot hold, since it reads back as `''`; the API holds `null` as
    `''` from the start, so `get()`, `onChange` and the saved workflow agree.
    This replaces the earlier rule that a mounted value is a string or a
    plain object or array, which made a pack wrap a number and change its
    reads. `MountedValue.set` commits through `WidgetHandle.setValue` and
    returns its result. The accessor belongs to its widget, as a listener
    does (decision 12): once that widget is off its node, `get()` is
    `undefined` and `set` is `false`, and a widget added later under the
    name is not reached through it.
    `onChange` runs for every other write, such as a load restoring the
    value or `setValue` on the widget's handle, with the value the widget
    then holds, and not for the pack's own `set`.
19. `render` is called once, when the widget is on its node; `destroy` is
    chained on the widget's `onRemove`, after the host's own cleanup, and the
    host runs it when the widget is removed or when its node is. Both are
    called through the shared listener primitive, so a throw is reported.
    That `destroy` (and a declared type's teardown) is called once relies on
    the host fix in
    [Comfy-Org/ComfyUI_frontend#23520](https://github.com/Comfy-Org/ComfyUI_frontend/pull/23520),
    which fixes #23476 and is merged into `main`. On a base without it,
    `addWidget` in `src/scripts/domWidget.ts` calls a DOM widget's `onRemove`
    from its node's `onRemoved` after `removeWidget` has already called it, so a
    widget removed before its node has `destroy` called twice: once when it
    is removed and again when the node is. The API does not guard against
    this; these changes land on a `main` that carries the fix.
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
    `default` when it is a value the workflow can save other than `null`,
    else the type's `defaultValue`, else `''`.
    `set` commits through the same edit as `setValue`; while the node is
    still being made, and so in no graph, it writes the value without an
    undo step. A teardown `render`
    returns runs when the host releases the widget. `serialize` (saved and
    sent) defaults to `true`; `minHeight` is returned to the host, which
    sizes the node with it; `height` fixes the height as decision 8 says.

### Widgets in node definitions

23. The definitions feature left three more members to this one
    ([ADR-EXTENSIONS-NODE-API-0071](EXTENSIONS-NODE-API-0071-node-definitions-and-hooks.md)
    decision 39). `NodeDefBuilder.addWidget(def)` and `hideWidget(name)`
    are `onCreated` hooks of the type: each node of the type, as it is
    made, gets the widget through `widgets.add`, or has the named widget
    hidden through `setHidden(true)`. `NodeDefinition.widgets` adds each
    listed widget the same way, after the type's inputs; `define` no longer
    refuses it. Each definition is checked when it is given, as `add`
    checks one, and a refusal names the member. A widget a node already has
    is refused by `add` inside the hook, reported, and the node's other
    widgets are still added. `hideWidget` takes any text as a name, the
    empty one included, as `add` and `get` do (decision 9).

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
  `onSerialize`. That is API behavior on `LGraphNode`; see "Core
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
- The combo previews, `comfy.widgets.registerComboPreview` (2 packs, 2
  calls) and `assignComboPreview` (1 pack, 1 call), 21 sites with their
  fields. V2 asked the host to show a model's adjacent preview when the
  pointer is over a model in any combo's list, and to save a node's output
  image as a model's preview. The host has no mechanism for either. On the
  litegraph canvas the list is a `LiteGraph.ContextMenu` that
  `ComboWidget.onClick` builds with no hook per item; on the Vue canvas
  `WidgetSelectDefault.vue` renders the options with none either. The only
  previews in a combo are the asset picker's (`WidgetSelectDropdown`), which
  `assetService.shouldUseWidgetAssetPicker` turns on for Comfy Cloud only and
  fills from the asset service, not from an extension. The host does serve
  a model's adjacent preview, as a still image, from the backend route
  `/experiment/models/preview/{folder}/{path_index}/{filename}`, which the
  model library reads through `getModelPreviewUrl`; nothing writes one. The
  V2 members were served by the secure-nodes host's own routes and a
  frontend hook that ComfyUI does not have. Building the hover surface here
  would add a host feature from inside the API, for one canvas or by
  changing both canvases' combo components, so it needs a host change
  first.

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

A node's widgets are restored by position unless the experimental named
restore is on (decision 5). Filed as [#23744](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23744):

- **Title:** Undo, redo and reload restore widget values by position, so a
  widget removed or moved after its node is made shifts the values after it.
- **Reproduction:** on a KSampler, move `steps` to the front from an
  extension (splice `node.widgets`), set `cfg`, then undo the `cfg` change:
  `seed` holds 8, `control_after_generate` 42 and `steps` `"fixed"`, and
  the queued prompt sends them so. With `Comfy.Workflow.NamedValuesRestore`
  on, the values stay with their widgets.
- **Suggested direction:** restore by name by default where the saved node
  has `widgets_values_named`, which every save already writes, and keep
  restoring by position for workflows saved without it.

A DOM widget's fixed height used to be ignored on Vue nodes (decision 8),
filed as [#23743](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23743).
#23428 fixed it in `main` on 17 Nov, and the issue is closed.

A DOM widget's commit runs its `callback` twice, and a load that restores
its value runs it once (decision 13). Filed as [#23742](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23742):

- **Title:** A DOM widget runs its callback from its value setter.
- **Reproduction:** give a multiline text widget a `callback` that counts
  its calls. Type one character: it counts 2. Load a workflow that holds a
  value for it: it counts 1, though nobody edited it.
- **Suggested direction:** let `BaseDOMWidgetImpl`'s `value` setter write
  the value only, as `BaseWidget`'s does, and leave `callback` to the
  commit paths that already call it. A V1 extension that depends on the
  setter's call would need to call `callback` itself.

## Consequences

Changes outside the folder: `NodeHandle` gains `widgets` through the node
handle members seam (`createNodeHandles(handles, membersFor)`), and the edit
core's `nodeHandleMembers` returns every member but `widgets`. Widget values
and options are copied with `shared/savedCopy.ts`, as properties are.
`DefRegistry` gains `defineWidgetType` (decision 21), and `useWidgetStore`
gains `unregisterCustomWidget`. The DOM widget types (`src/types/domWidget.ts`,
`src/scripts/domWidget.ts`, `useDomWidgetStore().registerWidget`) take a value
of type `DOMWidgetValue`, which adds the numbers and booleans the host already
held at run time; the default value type stays `object | string`
(decision 18).

`createListeners` in `shared/listeners.ts` takes the arguments an event
carries as a type parameter and passes them to each listener through
`callListener`, so a widget's listeners share the one isolation path with
`onReady` and the node type hooks; `render`, `destroy`, `draw` and pointer
handlers are called through `callListener` too. The definitions registry now calls
`onRefreshed` listeners with no arguments, so the arguments the host passes
its extension hook do not reach a pack.

## What this feature replaces or duplicates, and why

- **The savable-value check.** `savableValue.ts` walks a value's own
  enumerable properties, as `structuredClone` copies them, to refuse what the
  workflow cannot save. `JSON.stringify` silently drops a function or
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
