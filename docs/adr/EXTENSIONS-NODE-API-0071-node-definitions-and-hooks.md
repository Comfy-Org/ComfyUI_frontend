# ADR-EXTENSIONS-NODE-API-0071: Node definitions and the hooks a pack adds to them

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
gives packs one versioned object, `comfy`, and handles to the nodes of the open
document. Packs also need to work with node types: read a type's definition,
add a type of their own, and add behaviour to a type, the work they do today
with the `beforeRegisterNodeDef` hook by patching the class the host generates
for each type. `comfy.defs` is that part of the API. In the census of the old
contract it is the most used member: `Comfy.defs` is reached by 112 of 125
stored packs and `DefRegistry.extend` by 109.

Two facts shape it. The host registers node types more than once: at startup,
again for every definition when node definitions are reloaded, and again when
late custom nodes turn on
([ADR-EXTENSION-LOADING-0048](EXTENSION-LOADING-0048-late-custom-nodes-turn-on-after-the-editor-opens.md)).
And a pack's module may run before or after the types it extends are
registered, so `extend` cannot depend on the order.

## Decision

### Where the API hears of node types

1. The API registers one extension with the host's extension service, named
   `Comfy.NodeApi.v4.NodeTypes`, when the store publishes the API, before any
   extension module loads. It is registered once however often the API is
   published. Its `beforeRegisterNodeDef` hook records each type the host
   registers and applies the matching extensions to it; its
   `refreshComboInNodes` hook tells `onRefreshed` listeners. The host's hooks
   are used as they are: no host function changes what it does. The
   extension is in the extension store's always-enabled list, so a user who
   switches it off in the extension list does not silently turn off every
   pack's hooks; the list shows it as read-only, as it shows the other
   entries the store fixes. The name lives in its own module so the store
   can name it without depending on the API.
2. The API keeps its own index of node types: each type its hook heard of and
   each type a pack defined, in the order each first registered, with a
   frozen JSON copy of the host's definition as the hook heard it, before the
   extensions after it change it (the image upload extension adds an `upload`
   input, for example), so `get` and `builder.def` give what a function
   selector and `apply` saw, whenever `extend` runs. A type registered again
   replaces its entry in place. `get`, `has`, `all` and `extend` read this one
   index, so a type that `extend` would apply to is exactly a type `has`
   reports.

### `extend`

3. `extend(selector, apply)` calls `apply` with a builder for each type the
   selector picks: at once for the types already in the index, and later for
   each type as it registers. A type registered again is extended again, with
   its new definition, as the legacy hook is. The hooks on a type run in the
   order their extensions were made, whatever order the applications ran in,
   so an extension made inside another's `apply` keeps its place when the type
   registers again. An extension made after nodes of the type exist reaches
   only the nodes that join a graph after it was made (decision 17). Every
   stored pack extends while its module
   evaluates: the 63 `extend` calls that are not at the top of their module,
   in 30 packs, run in a loop or a function the module calls as it loads,
   and none from an event, a timer or `onReady`.
4. A selector is a type name, a list of names, a `RegExp` tested against the
   name, `{ category }` with a name or a `RegExp`, or a function given the
   definition. Each form is used by stored packs. A pattern is copied without
   its `g` and `y` flags, so it answers the same for every type. A function is
   asked through the listener isolation of ADR-EXTENSIONS-NODE-API-0070 decision 14: one that
   throws is reported and does not pick the type, and only `true` picks it.
   The definition is built only when a function selector or an `apply` needs
   it, once per registration.
5. Anything else is refused with a `TypeError` before anything is registered:
   a value of another kind, an object with fields other than `category`, a
   category that is neither text nor a pattern, a list holding a non-name, or
   an `apply` that is not a function. A selector, definition or menu item
   whose reads throw, as a hostile or revoked `Proxy`'s do, is refused with
   a `TypeError` naming the member too, not with the error it threw: only a
   refusal the API made itself (`isInvalidArgument`) passes through as it is.
6. An `apply` that throws is reported and the others still run, and none of
   its hooks is kept. `apply` is synchronous; one that returns a promise has
   its rejection reported, and a hook it adds after its first `await` is
   refused because the builder has closed. An extension made, or a type
   defined, inside an `apply` is applied once to each type. Reading the
   type's definition happens inside the same isolation, so a definition that
   cannot be read is reported and skipped and the extension stays whole.
7. The disposer stops later applications of that extension and removes the
   hooks it has already added, and is safe to call twice. An `apply` that
   calls its own disposer keeps none of the hooks it added.

### Reading definitions

8. `get(type)` gives a new frozen copy of the definition each time: type,
   title, category, description, inputs, outputs, hidden inputs and whether
   it is an output node. Inputs are the required ones then the optional ones,
   in the order the server declared them. An input's `options` and the hidden
   inputs are copied as JSON and frozen, so nothing a pack does to them
   reaches the host. A combo input carries its `values`, from either combo
   spelling the server uses. The title and description are the ones the
   editor shows, in the user's language, and a type with no display name is
   titled by its name, as the host titles its nodes; so is a definition given
   `''` as its title, because `registerNodeType` replaces a falsy title with
   the class name. `localizedName` is the
   input label the editor shows. The host tolerates some malformed server
   definitions (outputs sent as text, for example), so the API reads each part
   it cannot use as empty, an input whose spec is not a list is left out, and
   one bad definition changes nothing for the others.
9. `has(type)` and `all()` read the same index; `all()` lists the types in the
   order each first registered. A type name that is not text is refused.

### `define`

10. `define(definition)` registers a node type the pack owns, through
    `LiteGraph.registerNodeType`, as packs register frontend types today. The
    class is the API's own subclass of `LGraphNode`: it adds the declared
    inputs and outputs, and takes the title, category and description. With
    `execution: 'frontend'`, the default, its nodes are virtual, so the prompt
    builder leaves them out. With `'backend'` its nodes carry the type as
    their `comfyClass`, so the prompt sends them as that `class_type`; the
    server must know a class of that name. Every stored pack that defines a
    type passes `'frontend'` (20 sites) and none passes `'backend'`, and a
    defined type with no server class could not run, so `'frontend'` is the
    default. The type joins the index, and every extension that picks it
    applies. An output's `shape` is given to `addOutput` as the host's
    `RenderShape`, through the name table `updateSlot` uses
    (`edit/slotVocabulary.ts`), so the host draws and saves it and a load
    keeps it; `'default'` leaves the host's own choice. `get` does not report
    it, as a server definition has none. rgthree declares its relay's output
    `shape: 'directional'` through two helpers, which the census did not
    follow (acceptance finding B7); inputs take no shape, as in V2.
11. A definition is checked whole before anything is registered: a plain
    object of the documented fields only, a type name that is non-empty, is
    not a property of `Object.prototype`, and is not registered yet, text for
    the title, category and description, slots of exactly a text `name` and a
    text `type`, and for an output an optional `shape` of `'default'`,
    `'optional'`, `'list'` or `'directional'`, and `'backend'` or
    `'frontend'`. An empty slot name is allowed because a stored pack
    declares one.
12. The disposer unregisters the type and removes it from the index, only if
    the type is still the one this call registered. A type the host has
    registered under the same name since is left alone.

### Refresh

13. `refresh()` asks the host to reload the node definitions and resolves to
    the host's answer: `false` when the host did not apply them (it answers so
    when late custom-node hooks are owed and the fetch fails). A failure of
    the reload itself, such as an ordinary failed fetch, rejects, as the
    host's reload does, and the JSDoc says both. Review finding B-19 asked for
    a rejection when the reload is not applied; the repository's
    error-handling guidance asks for a command's outcome as a `boolean`, and
    both reviewers of PR 1 would keep it with the documentation complete, so
    it stays a `boolean`.
14. `onRefreshed(listener)` is told after every reload, whoever asked for it,
    through the listener primitive of ADR-EXTENSIONS-NODE-API-0070, which gains `notify()` for
    delivery that keeps its listeners. Every pack callback the API calls,
    hooks, menu entries, `onRefreshed` and `onReady` listeners and `apply`
    alike, goes through one isolation
    (`callIsolated`): a callback that throws is reported, and one that returns
    a promise has the promise's rejection reported the same way, so an
    `async` hook's failure does not become an unhandled rejection.

### Lifecycle hooks

15. The builder offers `onCreated`, `onConfigured`, `onRemoved`, `onExecuted`,
    `onSerialize` and `onResized`. Each takes a function, refused with a
    `TypeError` otherwise. The builder's methods throw a `TypeError` once the
    `apply` callback returns: no stored pack registers a hook later, and a
    hook added then would have no owner to remove it with. The hooks of an
    `apply` that throws are dropped with it.
16. Each hook is called with the node's handle, resolved in the node's own
    graph, so a node in a subgraph has a handle there. A hook is called only
    for a node that is in a graph; a node being built, or one configured before
    it joins, has no handle yet.
17. Hooks are listeners, not overrides. A hook reaches a node if the node
    joined a graph after the extension that registered it was made, and then
    every event of that node it covers, from the moment it joins; it never
    reaches a node that was already in a graph, and it is never replayed for
    past events (`onCreated` is not told of existing nodes). Each extension
    has a number (the count of extensions made before it), and the API stamps
    a node with the number of extensions made so far when it joins, through
    the host's `add_node` graph intent, which a load, a paste, an undo or redo
    and a node added to a subgraph all raise. A node is eligible for an
    extension whose number is not above its stamp; a node that joined while
    no extension had a hook has no stamp and is eligible for none made later.
    Because the rule does not depend on how the host wired a node, a node that
    core gave its own copy of a method (`useErrorClearingHooks`' per-node
    `onConnectionsChange`, a DOM widget's `onRemoved` and `onResize`) behaves
    like every other node that was already there: not reached by a late
    extension, reached by one made before it joined. The API reaches the nodes
    with a dispatcher put on the prototype of the class the host made for the
    type, calling what was there first. It never changes a prototype chain,
    never patches a node, and never replaces a method core or a pack put on a
    node. A dispatcher is put on a class the first time a hook needs it and
    stays, so extending and unsubscribing any number of times leaves one
    dispatcher per method and class; a pack that assigns its own method on the
    prototype or on a node over a dispatcher replaces it, as it would replace
    any wrapper, and the node then hears no hook through that method. For a
    notification the method the class already had runs first, unchanged; then
    each reached extension's hooks run in the order the extensions were made.
    A failing hook is reported and the others run. The dispatcher looks up the
    callbacks for the type at each call, and again when an extension's hooks
    were removed since, so a callback removed even by an earlier hook of the
    same delivery is not called, and delivering to k callbacks costs k, not k
    squared; a hook added during a delivery is not part of it. A hook sees a
    value as a frozen copy and can change it only where its contract says so
    (`onBeforeConnect` refuses with `false`, `onSerialize` adds fields, the
    property event's `setValue` and `reject`); with several extensions, any
    `false` refuses, the added fields are merged in order (a later extension's
    field wins), and the last `setValue` wins. A dispatcher delivers only for
    a node whose type is the one it was made for: a class registered under
    another name that extends a registered class hears none of its hooks.
    `onCreated` and menus are found by the node's type name, not through a
    prototype, so they are given only for a node whose class, or one it
    extends, has a dispatcher (the class the host registered for the type, or
    one `define` made). A class a legacy pack registers over an extended type
    hears no hook at all until the host registers the type again; and a
    second API instance in one page does not hear the nodes of a class only
    the first one registered. A node of a class the host replaced since is not
    reached by an extension made after the replacement, as it is not one that
    joined later. The API listens for the graph intent only while some
    extension has a hook; a node cannot be told its stamp otherwise, which is
    why an extension made while none did sees no node that joined before it.
18. `onCreated` hears a node join a graph through the host's graph intents: the
    `add_node` intent `LGraph.add` announces, whose source is `load` while a
    workflow loads (`LGraph.configure`) and while API-JSON and A1111 imports
    add their nodes. That source is the event's `loading` (review finding
    B-07). Undo, redo and converting to a subgraph rebuild the graph through a
    load, so their nodes are `loading` too. `restored` is true while loading,
    and for a node configured before it joined. The host's paste, duplicate
    and alt-drag copy (`LGraphCanvas._deserializeItems`) add the node first
    and configure it after, so such a node is not `restored`; its saved state
    reaches `onConfigured` right after `onCreated`, and overwrites what an
    `onCreated` hook set from defaults. Telling a paste apart needs the host to
    mark clipboard adds, which is a core change (ticket draft in the report).
    The API listens for intents while some extension has a hook (decision
    17).
19. `onConfigured` gives a frozen JSON copy of the saved node, made only when
    some hook asks for it. A node
    configured before it joined a graph is told once it joins, after
    `onCreated`. During a load, a paste and a duplicate the node joins first
    and is configured after, so `onCreated` comes first there too.
20. `onRemoved` is called before the node leaves its graph, so its handle still
    reads it. A load, an undo and a redo rebuild the graph, so they remove
    every node and add it again: `onRemoved` does not mean the user deleted
    the node, and the JSDoc says so.
21. `onExecuted` gives the texts and images of the server's output and a frozen
    JSON copy of all of it (`raw`), made only when a hook will receive it. A text that is not a string and an image
    that is not an object are left out of the lists, not of `raw`.
22. `onSerialize` returns fields to add to the saved node; they come back in
    the data `onConfigured` gives, through the host's extension payload. A
    result that is not a plain object, or that names a field the node saves
    itself (`isNodeCanonicalField`) or `extensions`, is refused whole and
    reported.
23. `onResized` gives the node's new size, frozen.
24. A defined type's definition may declare `onCreated`, `onConfigured`,
    `onRemoved` and `onSerialize`; they are applied as an extension of that
    registration of the type only, made by `define` and removed by its
    disposer, and they run before any other extension's hooks on the type. A
    host type registered later under the same name does not get them.

### Connection, property and pointer hooks

25. `onConnectionsChanged` gives the side, index and name of the node's slot,
    whether it is now connected, and the node and slot at the other end of the
    link the host reports, on a disconnect too; a subgraph's own input or
    output is no node, so for a link to one both are `undefined`. When a node takes saved state,
    `LGraphNode.configure` reports every input as connected, with no link for
    the unlinked ones; the API passes on only the inputs with a link, so a
    loaded, pasted or undone node tells of the links it really has. The name
    is read from the slot the host passes with the change, not looked up by
    index, because removing a connected slot shifts the slots after it before
    the host reports the disconnect (review finding A-02). For a link to a
    subgraph's input or output the host passes the subgraph's slot instead, so
    the API names the node's slot at that index; when such a slot is removed
    with its link, that is the slot that moved into its place, or the
    subgraph's slot when no slot is left at that index. Passing the
    node's own slot there is a core change (ticket draft in the report).
26. `onBeforeConnect` is asked before a link is made to an input
    (`onConnectInput`) or from an output (`onConnectOutput`) of the node, with
    the side and index of the node's own slot. The link is refused if the
    type's own method refuses it, in which case the hooks are not asked, or if
    any hook returns `false`. A hook that throws is reported and does not
    refuse. The other end's node, slot and type are not given: no stored pack
    reads them.
27. `onPropertyChanged` hears every call of the node's `onPropertyChanged`:
    `setProperty`, and each property a saved workflow restores in `configure`.
    `value` is a frozen copy as a workflow would save it, made when a hook
    first reads it. `setValue` stores a frozen copy of the pack's value in the
    node's properties, where `setProperty` has just stored the edited one;
    `undefined` and a value a workflow cannot save are refused with a
    `TypeError`, and nothing is reported: `setValue` replaces a value and
    does not delete one. A deletion through the API's `setProperty(name,
    undefined)` is heard with `value` `undefined`; a hook that rejects it or
    gives a value keeps the property. The
    event is settled only while the hook that received it runs: afterwards
    `setValue` and `reject` throw a `TypeError`, as the builder does.
    `reject()` answers `false`, so `setProperty` puts the earlier value back;
    `configure` ignores the answer, so a restored value is kept. When several
    hooks answer, the last one wins. A refusal by the type's own method
    stands and the hooks are not told.
28. `onHover` and `onDoubleClick` are delivered from the node's
    `onMouseEnter`, `onMouseLeave` and `onDblClick`, which only the canvas
    renderer calls; the Vue node renderer does not, and the JSDoc says so.
    `onDragOver` is asked from the node's `onDragOver`, which both renderers
    call while a browser drag is over the node (the editor's `dragover`
    listener in `app.ts` and Vue nodes' `LGraphNode.vue`), with the node's
    handle and the browser's own `DragEvent`, as V2 gave it; no host object
    is passed. The node is the drop target if the type's own method accepts,
    in which case the hooks are not asked, or if any hook returns `true`; a
    hook that throws is reported and does not accept. The answer marks the
    node as the target, and the editor then gives the drop to the node's
    `onDragDrop` if it has one and otherwise handles it itself. rgthree asks
    it for every node type to offer a drop-to-import; the census missed it,
    on a builder it could not type (acceptance finding B8).
    `onDrop` is asked from the node's `onDragDrop`, the host's own drop path:
    the editor's document `drop` listener in `app.ts` awaits it for the drop
    target, and the node claims the drop if it answers `true`; otherwise the
    editor loads the dropped files itself. The dispatcher calls the method
    the type had first, awaiting it, and if that claims the drop the hooks
    are not asked. Otherwise every reached hook is asked, in order, with the
    node's handle and the browser's `DragEvent`, as V2 gave them; a hook may
    answer with a promise, and the node claims the drop if any hook answers
    or resolves `true`. A hook that throws or rejects is reported and does
    not claim. When the type has no method of its own, the hooks are called
    within the dispatcher's call, before its first `await`, so they run while
    the browser is still delivering the drop event. Hooks are listeners
    (decision 17), so two extensions that both claim a drop are both asked;
    no stored pack has two drop hooks on one type. rgthree's drop-to-import
    adds `onDrop` beside `onDragOver` in the same `apply`. Which drops reach
    `onDragDrop` is the renderer's: the canvas renderer gives the drop only
    to the node that accepted the drag (`app.dragOverNode`), and Vue nodes'
    `LGraphNode.vue` makes any node the pointer drops on the target, whether
    it accepted the drag or not, unless something under it already handled
    the drop. The API asks the hooks whenever the host asks the node, and
    the JSDoc says so. The host's own drag handling for upload widgets
    (`useNodeDragAndDrop`, on image, audio and 3D upload nodes) assigns
    `onDragOver` and `onDragDrop` on the node itself, which replaces the
    dispatchers for that node as any assignment does (decision 17), so the
    hooks are not asked there.
29. A definition may also declare `onConnectionsChanged` and
    `onPropertyChanged`.

### Menus and colours

30. `addMenuItem(item)` adds an entry to the context menu of the type's
    nodes, through the host extension's `getNodeMenuItems` hook, which both
    renderers' menus collect. An item is checked whole and copied when it is
    added: a plain object of `label`, `when`, `run`, `items` and `order` only,
    a label that is text or a function, functions for `when` and `run`, a
    finite `order`, a submenu that is a function or a list of `{ label, run }`,
    and `run` or `items` or both. Submenus are one level deep, as every stored
    pack uses them.
31. Each time a node's menu opens, an item is shown only when `when` returns
    `true`; its label and a submenu function are asked then, with the node's
    handle, inside the listener isolation, so an item whose function throws or
    gives something unusable is reported and left out and the others are
    shown. The failure of an item is reported the first time only, not on
    every open. An item with an empty submenu is shown only if it has `run`.
    Entries are sorted by `order` (none counts as 0); ties keep the order they
    were added in. A `run` for a node that has been removed since the menu
    opened does nothing.
32. `typeColor(type)` reads the colour the host draws a data type's links in
    (`LGraphCanvas.link_type_colors`), and `undefined` when the type has none
    or an empty one.
33. `setTypeColor(type, color)` colours a type the palette leaves uncoloured,
    such as one the pack introduced. A type whose colour is the newest pack
    colour for it may be coloured again, by the same pack or another (review
    finding B-15): the newest colour shows. Each disposer removes only its own
    colour; when it removes the colour on show the next newest shows, and
    when it removes the last one the table gets back what it held before the
    first, unless a palette has coloured the type since. A type the palette
    colours, and a name `Object.prototype` has (`__proto__`, `constructor`),
    are refused with a `TypeError`.
34. Applying a palette writes an empty colour for every data type it has no
    colour for, which would clear a pack's colour. The theme service calls the
    host side's `reapplyTypeColors()` after it applies a palette; it puts back
    each pack colour the palette cleared and leaves a colour the palette set.
35. `nodeColor(name)` gives a frozen copy of an entry of
    `LGraphCanvas.node_colors`, and `undefined` for a name the menu does not
    have, a property of `Object.prototype` included.
36. `isTypeCompatible(outputType, inputType)` is
    `LiteGraph.isValidConnection`, the rule the host links by.
37. Every type name given to `define`, `setTypeColor` or `typeColor`, every
    colour and every colour name must be non-empty text. `extend`, `get` and
    `has` take `''` as a name no type has.

### Left out

38. Members of the old contract that no stored pack calls are not built:
    `NodeDefBuilder.setTitle`, `setCategory` and `setExecution`;
    `NodeDef.source`; `PropertyChangeEvent.previous`;
    `BeforeConnectEvent.peerNodeId`, `peerIndex` and `peerType`;
    `NodeDefinition.supply`, `onExecuted`, `onDragOver`,
    `onDrop` and `onPromptSerialize` (0 packs each). `NodeDefBuilder.onDrop`
    was counted with them, but rgthree calls it beside `onDragOver` (the
    acceptance run found both), so it is built (decision 28). With `setTitle` gone, a
    late extension cannot rename a type, so review finding A-08 cannot arise;
    with `setExecution` gone, only `define` decides whether a type runs in the
    frontend, on a class it owns, so disposing an extension cannot change it
    (A-07).
39. Members that need another part of the API are left for it, and a
    definition that uses them is refused as having an unknown field until
    then: `NodeDefinition.widgets` (7 packs), `NodeDefBuilder.hideWidget` (9)
    and `addWidget` (3), and `DefRegistry.defineWidgetType` (3) need the
    widget definitions and handles; `NodeDefinition.resolve` (6),
    `NodeDefBuilder.setSupply` (1), `onPromptSerialize` (1) and `onPreview`
    (1) need frontend execution and previews. `NodeDefinition.presentation`
    (rgthree, 2 definitions; it is in the later V2 contract stored with
    rgthree, not in the V2 contract document) is how a node is drawn, so it is left for the
    part that draws pack-owned nodes (`canvas`): of its fields, a hidden
    title, `resizable` and `collapsible` have host owners
    (`title_mode`, `resizable`, `collapsable`), and `chrome: 'none'`,
    `sizing: 'fixed'` and `pinnedInteraction: 'pass-through'` have none in
    either renderer.
40. `NodeDefBuilder.onUnplacedLink` (1 pack) and its event are not built. The
    host announces a link dropped on a node (`dropped-on-node`) before it
    tries to place it, and nothing after it fails to, so a hook for "the host
    found no slot" needs a new event in LiteGraph's `LinkConnector`, which this
    API does not change.
41. Nothing here exists for a sandbox: no proxies, no capability checks, and
    no hook made asynchronous for one. `onPromptSerialize` was awaited so
    that a sandboxed pack could answer, and is not built. `onDrop` is the one
    hook whose answer the API waits for when it is a promise, and not because
    of a sandbox: the editor itself awaits a node's `onDragDrop`, so the hook
    keeps the host's own shape. An earlier text of this decision left `onDrop` out as a
    sandbox hook; that reason was wrong.

42. Conversion rows (V1 pattern, V4 form, not one to one because):
    - A prototype patch or `nodeCreated` override made after nodes exist,
      which reached those nodes (unless core gave them a copy) -> a late
      `extend`, which reaches only nodes that join afterwards. The V4 form is
      the same for every node whatever core did to it; the pack reads
      existing nodes through `comfy.graph`.
    - An override that reads or writes `this` -> a hook given a handle and
      frozen copies; fields go through the read and edit members.
    - An override that runs its code before the previous method, or changes
      its arguments or return value -> no form: hooks run after the method
      the class had, and answer only where the contract says (decision 17).
    - An override whose exception stops the caller -> a hook that throws is
      reported and the host and the other hooks go on.
    - An override that also runs for a node being built or not yet added (a
      `setSize` or `setProperty` in a constructor) -> hooks run only for a
      node in a graph (decision 16).
    - `nodeCreated` at construction -> `onCreated` when the node joins a
      graph (decision 18).
    - An `onSerialize` override that edits the saved object -> hooks return the
      fields to add, and refuse a field the node saves itself.
    - Overrides that run in module order -> hooks in the order the
      extensions were made (decision 3).
    - An `onDragDrop` override that handles a drop before the type's own
      method, or instead of it -> `onDrop`, asked only when the type's own
      handling leaves the drop.
    - An assignment over a method -> unchanged: it replaces the dispatcher.
    - A subclass registered under another name -> hears none of the hooks of
      the class it extends; extend its own type.

## Alternatives considered

- Call the API from `litegraphService.registerNodeDef`, as the earlier
  attempt did. That changes a host function to serve the API, when the
  extension hook it already calls gives the same information.
- Read definitions from the node-definition store. It is updated only after
  the types are registered and only when the Vue app is ready, so a pack
  extending at registration time would see a type `get` does not know; and it
  lists frontend-only types with inputs and outputs it does not know, for
  which a definition with none would be wrong. The API's index holds one
  frozen JSON copy of each definition it heard (measured by the round-two
  review at 4 ms to 12 ms for 1,000 types).
- Hear `onCreated` through the prototype's `onAdded`. It runs before the
  host's graph intent, so it cannot tell a load from an import, and
  `ChangeTracker.isLoadingGraph` is set only for `loadGraphData`.
- Hear node lifecycle through each graph's `node:added` and `node:removed`
  events. A listener per graph would have to follow every graph the host
  makes and replaces, and `node:removed` fires after the node has left.
- Store a `setValue` replacement through `setProperty`. It runs inside the
  host's `setProperty`, which then stores its own value over it or puts the
  earlier one back.
- Remove a dispatcher when its last callback goes. Another pack may have
  wrapped the method since, and taking ours out would drop theirs.
- Index extensions by type name so registration does not test every
  extension. Registration tests each extension once per type, which is a
  string comparison for most selectors; nobody has measured a cost that an
  index would remove.
- Make `refresh()` reject when the host did not apply the reload, as review
  finding B-19 asks. The repository's error-handling guidance asks for a
  command's outcome as a `boolean` rather than a throw, and its lint rule
  refuses `throw new Error`. Resolving `false` makes the failure observable,
  which is what B-19 is about; the open question is recorded for the owner.

## Consequences

- A type a legacy pack registers directly with LiteGraph is not in the index:
  `has` is false for it and `extend` does not apply to it. The core frontend
  types (`Reroute`, `Note`, `PrimitiveNode`) are such types. No stored pack
  extends one.
- The type of a subgraph placed as a node is outside the index too: the host
  registers it with `registerSubgraphNodeDef`, which does not call
  `beforeRegisterNodeDef`, so `extend` does not reach subgraph nodes and `has`
  is false for a subgraph's id.
- Hooks on a type run in the order their extensions were made, a definition's
  own first, however the pack modules loaded.
- An extension made late reaches the nodes that join a graph afterwards, and
  never one that was already there (decision 17); a pack that needs the
  existing nodes reads them with `comfy.graph` and acts on them itself.
- A legacy pack that replaces a prototype method without calling the one it
  replaced drops the API's dispatcher for that type, as it drops another
  pack's today.
- A property bound to a widget (`options.property`) shows the edited value in
  the widget after a `setValue` or a `reject()`, because `setProperty`
  updates the widget with the edited value after the hooks run.
- `ExecutionResult` is declared with these hooks because `onExecuted`
  delivers it; the frontend-execution part of the API uses the same type.
- `onUnplacedLink` waits for a core change; the ticket proposed for it is a
  cancelable `link-unplaced` event that `LinkConnector` dispatches when a link
  dropped on a node finds no slot, carrying the node, the link, the side and
  the pointer event. Nothing in this API works around its absence.
- The type colours are global, as the host's table is: a pack's colour for a
  type shows in every document.
- Host changes: `useComfyApiStore().publish()` registers the extension;
  `themeService.setActiveTheme` calls `useComfyApiStore().reapplyTypeColors()`
  after it applies a palette; the extension store lists the extension as
  always enabled.

## What this feature replaces or duplicates, and why

- **The type index** sits beside `LiteGraph.registered_node_types` and the
  node-definition store. The first has no definitions and includes types that
  were never defined; the second is updated later than the hook. See
  "Alternatives considered".
- **Reading a definition** does not use `transformNodeDefV1ToV2` from
  `@comfyorg/object-info-parser`, which merges the inputs and names the
  outputs too. It names an unnamed output `output_<index>` where the host's
  nodes and this API use the type, it spreads an input's declared options
  into the spec beside `name` and `type` (renaming some, as `type` becomes
  `chartType` for a chart) instead of keeping the declaration as the pack
  wrote it on its own input, and it assumes a well-formed definition, which
  decision 8 does not.
- **Copying a definition** uses the JSON copy and deep freeze that handles
  already use for property values, moved from `nodeHandle.ts` to
  `nodeApi/shared/savedCopy.ts` so both use one. Input types and combo values
  come from `getInputSpecType` and `getComboSpecComboOptions` in
  `@comfyorg/object-info-parser`, and the shown names from the host's own
  `resolveNodeDefText` and `resolveNodeDefSlotText`.
- **Reading the load state** uses the source the host's graph intents carry
  (`onGraphIntent`), not a new flag.
- **Saved fields** go through the host's extension payload in
  `extensionPersistence.ts`, and the fields it saves itself are its own list
  (`isNodeCanonicalField`).
- **Type colours** are the host's own table, with a record of each pack's
  claim beside it so a disposer can take back only its own colour.
  `getLinkTypeColor` in `litegraphUtil.ts` reads the same table but gives the
  default link colour for a type with none, which would hide that the type
  is uncoloured.
- **Calling a pack callback** goes through `callListener`, the error isolation
  the listener primitive already had, now exported so every callback the API
  calls is reported the same way.
