# ADR-EXTENSIONS-NODE-API-0074: Platform services of the V4 node API

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
set out the V4 node API: one versioned object, `comfy`, and handles that
belong to a document. Packs also use services around the graph: their
settings, text they keep for the user, commands and keys, calls to the
backend, model lists, and contributions to the app's chrome. Today they reach
each through `app`, `api` or a store, so a pack breaks when one of those
changes.

Each service here is a thin wrapper over a host owner that already exists: a
store, the backend client, or a service. It adds no capability a pack does not
have today. A pack gets values and its own registrations back, never a store
or a host object. No member takes or returns a node handle.

The members are those of the earlier contract that at least one stored pack
calls, counted by the census of 128 stored packs (`census/CENSUS.md`,
2026-11-11). Counts below are "packs / call sites".

## Decision

### Common rules

1. Every member validates what a pack passes before it reads or changes
   anything, and refuses a value it cannot use with the `TypeError` of
   decision 13 of ADR-EXTENSIONS-NODE-API-0070, naming the member the pack
   called, the field and the value
   (`settings.declare needs attrs.min as a finite number, not -Infinity.`).
   An object a pack passes is read field by field, once each, through
   `packArguments.ts`; an extra field is ignored. A number must be finite.

2. A failure the pack cannot prevent, such as a server that refuses a request
   or cannot be reached, is a value and not a throw, as
   `docs/guidance/error-handling.md` asks: `false`, `undefined`, or
   `{ ok: false }` where `undefined` already means something.
   The exceptions are `backend.fetch` (decision 16) and `settings.set`
   (decision 7).

3. Every callback a pack supplies runs through `shared/listeners.ts`: a
   listener set from `createListeners`, or `callListener` for one callback.
   One that throws is reported through `reportError`
   (`node_api_listener_failure`, tagged with the member) and stops neither
   the host nor another pack. An event a pack subscribes to follows its host
   source through `createHostEvent` only while a listener is registered.

4. A value handed to a pack is a string, a frozen copy the API made for that
   delivery, or a Blob, which cannot change. `jsonValues.ts` checks that a value
   holds only what JSON can (finite numbers, strings, booleans, `null`, lists
   and plain objects, refusing a cycle); a setting value that passes is copied
   with `savedCopy`, the shared copy handles use.
   A backend payload may also hold Blobs, which `savedCopy` would turn into
   empty objects, so `frozenJsonCopy` copies and freezes its lists and plain
   objects and keeps each Blob as it is.

### Settings (`comfy.settings`, 22 / 177)

5. `declare(setting)` (18 / 66) turns a pack's definition into the settings
   store's `SettingParams` and adds it with `addSetting`, the call
   `extension.settings` reaches. The value a user stored under the id is
   kept. The store skips a second registration of an id with a console
   warning; the API refuses it instead, so a pack learns its id is taken and
   cannot replace core's setting or another pack's. A declaration lasts for
   the page: the settings store has no removal, and `extension.settings` has
   none either.
6. The setting types are those packs declare: `boolean`, `number`, `slider`,
   `combo`, `text` and `color`. `knob`, `radio`, `password`, `image` and `url`
   have no use and are left out. The default must suit the type: a boolean, a
   finite number, a string or a number for a `combo`, a string. An option is a
   string or `{ value, label }`, mapped to the store's `{ value, text }`;
   `attrs` passes only the bounds given. Beyond types and finite numbers the
   API checks no more than the store and `extension.settings` do: a `min`
   above `max`, a `step` that is not positive, or a `combo` whose default is
   not among its options are passed on as given, for the settings panel to
   show as it does for an extension. A stored pack declares a `combo` with
   no options and the default `'unavailable'` when the machine has no disk to
   list (`Crystools-MonitorOnly`); refusing it would stop that pack loading.
7. `get(id)` (22 / 104) reads the store's value or default, for any id, core's
   included. `set(id, value)` (7 / 11) takes a value JSON can hold for any
   id, declared or not (the store saves an undeclared id too), applies it
   at once through the store and returns the store's promise: it rejects
   when the server cannot be reached and resolves when the server answers,
   even with a refusal, with the value applied but not saved. The store's
   `set` does not report a refusal; `setWithOutcome` does, for core's
   revertible settings only ([#23467](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23467)).
8. `onChange(id, listener)` (6 / 7) hears the store's `onSettingChanged`, the
   event the host itself watches. All listeners share one subscription,
   started with the first and stopped when the last leaves (finding B-12);
   each disposer removes only its own listener. The store announces a declared
   setting when it is declared and after each change, so a listener hears
   both. A `declare` definition's `onChange` (12 / 23) is called the same way,
   through `callListener`.

### Per-user storage (`comfy.storage`, 17 / 43)

9. `get`, `set`, `remove` and `list` call the backend client's user-data
   methods, which packs called directly before: `getUserData`,
   `storeUserData` (as text, overwriting, without throwing), `deleteUserData`
   and `listUserDataFullInfo`. A name is a relative path in the user's data,
   refused if it is absolute or has an empty, `.` or `..` segment, a backslash
   or a NUL, before any request. The client percent-encodes the name and the
   server decodes the path once more, so a `%` sequence in a name is decoded
   on the server: `x%41.txt` is stored as `xA.txt`, and `%2e%2e/x` reaches
   the server as `../x`, which the server refuses. The API takes such a name
   as the client does and leaves that decoding to the server, which owns
   the user's data.
10. `get` (17 / 26) resolves `{ ok: true, text }`, with `text` `undefined` when
    nothing is stored, or `{ ok: false }` when the server refused or could not
    be reached. `set` (17 / 23) and `remove` (4 / 7) resolve `true` or
    `false`; removing a name that holds nothing succeeds. `list` (3 / 4)
    resolves the names under a folder as `get` takes them, or `undefined`. The
    earlier contract rejected on a failed request; a stored conversion that
    wrote `await comfy.storage.get(name)` reads `.text` and checks `.ok`.

### Commands (`comfy.commands`, 31 / 102)

11. `register(command)` (18 / 41) adds the command to the command store with
    `registerCommand`, which `extension.commands` reaches, and its key to the
    keybinding store with `addDefaultKeybinding`, which `extension.keybindings`
    reaches. A command and its key are one definition, so a key cannot point
    at nothing. The store replaces a command registered twice with a console
    warning; the API refuses the id instead. The whole definition, the key
    combo included, is checked before either store changes (the rule of
    finding A-10 for importers, applied to commands). A registration lasts for
    the page: neither store can remove one, and `extension.commands` cannot
    either.
    A label is a string, or a function the command store calls each time it
    shows the label (`ComfyCommandImpl.label` and `menubarLabel`), as for a
    core command whose label follows state (3 stored sites: a toggle that
    reads "Follow" or "Stop following"). The API hands the store a function
    that calls the pack's through `callListener`, so a label that throws is
    reported and shows the command's id, as does one that gives no string;
    the store would otherwise throw into whatever rendered it.
12. A key another command already holds by default stays with it. The
    keybinding store throws for that; the API catches that one call, adds the
    command without the key, and returns `false`, where a legacy extension
    gets an error toast. The key is a default, so a key the user binds wins.
    `scope: 'canvas'` sets the target the host's own canvas keys use,
    `graph-canvas`, so the key does not run while the user types outside the
    graph. `meta` is folded into `ctrl`, because the host reads Cmd as Ctrl
    (`KeyComboImpl.fromEvent`); a combo keeping `meta` alone would have bound
    the bare key.
13. A command's `run` is called by the command store's `execute`, which awaits
    it and shows a failure to the user through the host's error toast, as for
    every command. It is not wrapped in `callListener`: the store already
    isolates both a throw and a rejected promise, and a second path would
    report one failure twice.
14. `run(id)` (4 / 7) resolves `false` for an id no command has, where the
    store's `execute` throws, and `true` once the store has handled it.
    `notify(notification)` (26 / 52) shows a toast through the toast store.
    `warn` maps to the store's `warning`; `life` must be a positive finite
    number of milliseconds, and without it the toast stays, as the host's
    default.

### Backend (`comfy.backend`, 30 / 124)

15. `url(route)` (15 / 30) and `assetUrl(route)` (4 / 8) are the backend
    client's `apiURL` and `fileURL`, so a URL follows the host's base path and
    web session. A route must start with exactly one `/`: `//host/x` and
    `/\host/x` would name another origin once a browser reads them, and
    `fileURL` prefixes only the base path, which is empty by default.
16. `fetch(route, init)` (14 / 22) is the client's `fetchApi`, with the
    credentials, user header, timeout and retries the host adds to its own
    calls. The pack's headers are copied into a new `Headers` first, so the
    credentials the client adds are not written into the pack's object;
    headers `Headers` cannot take are refused, naming `backend.fetch`. It
    keeps `fetch`'s contract: it resolves with the response whatever its
    status, and rejects when the server cannot be reached, as `fetchApi`
    does. This is the one call here whose failure is not a value: a pack
    replacing `api.fetchApi` or `fetch` expects that contract, and wrapping
    the response would hide the status and body it reads.
17. `on(event, listener)` (18 / 53) hears the client's
    `addCustomEventListener`, which also tells the socket to dispatch a
    message of a type it does not know, so a pack's own events arrive. The
    listeners of one event name share one subscription, started with the
    first and stopped when the last leaves. Each listener gets its own frozen
    copy of the payload, so one pack cannot change what another sees or what
    the host keeps. A payload that is neither JSON nor a Blob, which only a
    host-dispatched event could carry, is delivered as `undefined` and
    reported once per event name (`node_api_payload_not_copyable`).

### Models (`comfy.models`, 6 / 10)

18. `list(folder)` (6 / 8) is the backend client's `getModels`, the route the
    model store reads outside asset mode (`/experiment/models/{folder}`). Each
    name is listed once, in the backend's order, though a name may sit in
    several of the folder's paths. The client resolves an empty list for a
    folder the backend does not know. A failed request or a reply that is not
    a list of named entries resolves `undefined`. A folder must be one path
    segment of word characters, dots and dashes, not `.` or `..`, because the
    client puts it in the URL unencoded. The earlier contract fixed thirteen
    folder names; the backend decides which folders exist, and a pack
    registers its own. The model store is not used: it lists only folders it
    has already loaded, and in asset mode it reads the asset service instead.

### UI contributions (`comfy.ui`, 35 / 101)

19. A pack renders its own content. Every contribution with content hands the
    pack an element to fill (`render`) and calls it back when that element is
    taken down (`destroy`); the host never renders a pack's Vue component.
    Both callbacks run through `callListener`, and `mountedContent.ts` calls
    `destroy` once after each `render`, never without one, whichever host
    path takes the content down first.
20. `addSidebarTab(tab)` (7 / 7) registers a `custom` tab with the sidebar
    tab store, which `app.extensionManager.registerSidebarTab` reaches, and
    the host's `ExtensionSlot` renders it each time it is shown. The store
    accepts a second tab under an id; the API refuses it. The disposer
    unregisters the tab only if the tab it added is still the one registered,
    so an old disposer cannot remove a newer tab under the same id.
21. `addTopBarBadge(badge)` (3 / 4) and `addActionBarButton(button)` (14 / 20)
    keep the pack's items in a list per API, which the top-bar badge and
    action-bar button stores append to what extensions declare. Those stores
    read only `ComfyExtension.topbarBadges` and `actionBarButtons`, which an
    extension declares once; a badge that changes needed a reactive source.
    The handle's `update(changes)` re-checks the whole item with the changes
    applied, keeps its id and place, and returns `false` once the item is
    removed; a refused update names `ui.addTopBarBadge(...).update` or
    `ui.addActionBarButton(...).update`. `remove()` takes away only that
    item, so a stale handle cannot remove a later item under the same id. An id already shown is refused. A
    button's `run` is called with the click's `MouseEvent`, which a pack reads
    to place a menu at the pointer.
22. `showDialog(dialog)` (22 / 36) opens a dialog through the dialog store's
    `showExtensionDialog`, which prefixes the key with `extension-` and raises
    an open dialog with the same key rather than opening another. Its content
    is the host's `ExtensionSlot`, as for a sidebar tab. `close()` closes the
    dialog the call opened or raised, only while that dialog is still on the
    stack, so it cannot close a later dialog under the same key.
23. `showMenu(menu)` (3 / 15) opens LiteGraph's `ContextMenu`, the menu the
    canvas and core extensions open, at the pointer of the pack's
    `MouseEvent`. A label is shown as text, never as markup. The whole item
    tree is checked before the menu opens; an item has a submenu or `run`,
    not both. `MenuHandle.close` (0 / 0) has no use, so `showMenu` returns
    nothing; the menu closes on a choice or a click elsewhere.
24. `prompt(prompt)` (7 / 13) is the dialog service's `prompt`, the text
    prompt the host uses itself, with the label as both its title and the
    input's label. A cancel resolves `undefined`.
25. `mountViewportPanel(panel)` (2 / 3) appends a panel to the element that
    holds the canvas the renderer supplies (`CanvasSource.canvas()`),
    positioned against an edge or corner. There is no host owner for such
    panels; without the API a pack appends its own element over the canvas.
    Every offset must be finite and every size positive and finite (finding
    A-01). `ariaLabel` is required, so the panel's `region` role always has a
    name (finding A-14). An id already mounted is refused. `remove()` calls
    `destroy` once, while the panel is still in the document, and then
    removes it, even after the graph view itself was taken down; a stale
    handle cannot free the id of a later panel. Before the renderer has
    supplied a canvas there is no view, and the call mounts nothing and
    returns `undefined`.

### Graph overlays (`ui.mountGraphOverlay`, 3 / 94)

29. `mountGraphOverlay(overlay)` gives a pack a `<canvas>` over the graph and
    its nodes, for drawing that follows the graph as it pans and zooms
    (notes drawn on the workflow, resize handles on the selection, a floating
    preview). It returns its handle at once, even before the renderer has
    supplied a canvas: the three stored packs mount at import, before the
    app creates the graph view, and use the handle straight away. The
    element joins the graph view (the parent of the canvas the renderer
    supplies, as for a viewport panel) when there is one, and moves to the
    next graph view when the app shows another. `ariaLabel` is required, as
    for a viewport panel, because the overlay takes focus. An id already
    mounted is refused.
30. The overlay draws after each frame in which the graph draws its
    foreground, by chaining `LGraphCanvas.onDrawForeground`, the hook the
    host's DOM widgets and selection border chain. One chain serves every
    overlay, through `createHostEvent`; it starts with the first overlay and
    is undone with the last, giving the canvas back the handler it had.
    `redraw()` draws once at the next frame through the canvas's own frame
    hook (`onCanvasFrame(..., 'present')`), however often it is called, and
    holds no frame subscription between requests, so an overlay that is not
    redrawn costs nothing per frame. Each draw clears the element, sizes it
    to the graph canvas in device pixels, scales the context by the canvas's
    `dpr`, and passes the size in viewport pixels and a frozen viewport with
    the view's `scale` and `graphToViewport`, which converts with the
    canvas's `ds`. A hidden overlay is not drawn. `draw` runs through
    `callListener`.
31. Input. The element never takes the pointer itself (`pointer-events:
    none`), so a press the overlay does not want reaches the graph unchanged.
    While the overlay is visible and interactive, a capture listener on the
    graph view takes a press inside its hit regions (anywhere, if the pack
    set none; nowhere for `[]`), stops it from reaching the graph, focuses
    the element and calls `onPointerDown`; that pointer's moves and its
    release or cancel are then followed on `window` in the capture phase,
    kept from the graph, and passed on, until it is released, even if the
    overlay stops being interactive meanwhile. The window listeners exist
    only while the overlay holds a pointer. A press on an element after the
    overlay in the graph view, which is drawn above it (a viewport panel), is
    left to that element. While the interactive overlay has focus, its keys
    go to `onKeyDown` and stop there, so the app's shortcuts on `window` do
    not also run. Each event a pack gets is a frozen copy, with the point in
    viewport pixels and in graph space (`convertEventToCanvasOffset`). Every
    callback runs through `callListener`.
32. Members are those the three stored packs use. The pointer event carries
    `pointerId`, `pointerType`, `button`, `viewport` and `graph`; the key
    event `key`, `repeat`, `ctrlKey`, `metaKey` and `shiftKey`; the viewport
    `scale` and `graphToViewport`. The handle has `redraw`,
    `setInteractive`, `setVisible`, `setHitRegions` and `remove`. A hit region
    is a circle or a rectangle with finite coordinates and positive sizes.
    `remove()` takes the element away, drops a pointer it holds, frees the id
    and is safe to call twice.

### Localization (`comfy.localization`, 1 / 1)

26. `registerCatalog(locale, catalog)` merges `catalog.messages` into the
    app's vue-i18n messages for `locale` through `mergeExtensionI18n`, a
    function this ADR adds to `src/i18n.ts` beside `mergeCustomNodesI18n`. It
    merges into a locale already loaded at once, and keeps the messages so
    `loadLocale` merges them again, after the custom nodes' data, when a
    locale loads later; until then the app has only its English messages for
    that locale. `mergeCustomNodesI18n` could not be used: it replaces all
    the custom nodes' data each call, so one pack's catalog would remove
    what the `/i18n` route gave and every other pack's. Merging straight into
    vue-i18n without the host function would be lost when `loadLocale`
    replaces a lazily loaded locale's messages. A pack registers the catalogs
    of every locale it carries at load (the one stored pack registers five),
    and none of them causes a locale file to be fetched.
27. The locale must be one the app ships (`localeDefinitions`), as the
    earlier contract asked; a legacy id such as `zh-CN` is refused, because
    the app never loads it. `messages` must hold only strings, `null` and
    plain objects, with no loop; it is copied with `savedCopy` before it is
    kept, so a change the pack makes later reaches nothing. `null` is taken
    as vue-i18n takes it: the key resolves to the fallback locale. A catalog
    lasts for the page and later catalogs win: vue-i18n has no way to take
    merged messages out of a locale, so `registerCatalog` returns nothing,
    as `settings.declare` does.

### System (`comfy.system`, 1 / 2)

28. `monitor()` reads the backend's `/system_stats` through the backend
    client's `getSystemStats`, the route the host's system-stats store reads.
    The store is not used: it keeps the first reading, and a pack polling
    for a fresh one would get the same values. The route gives the RAM
    (`ram_total`, `ram_free`) and each device's name and memory; the
    snapshot keeps the earlier contract's shape with what the route has.
    `cpu.utilization_percent`, each accelerator's `utilization_percent` and
    `temperature_c` are `null` and `volumes` is empty, because the backend
    reports none of them; the earlier contract already gave `null` for a
    sensor the host lacks. The CPU device is not an accelerator. A device's
    id is its name, which the backend makes unique (`cuda:0 ...`). The reply
    is read field by field; a failed request or a reply of another shape
    resolves `undefined`. The snapshot is frozen.

### Left out

The sandbox the earlier contract served is out of scope, and nothing here
exists only for it. A pack is trusted code in the page. The guest SDK's
`comfy.files`, `comfy.clipboard`, `comfy.media`, `comfy.crypto` and
`comfy.element` are not built; a pack uses the browser's own APIs.

- `commands.playSound` and `PlaySoundDef` (2 / 2) existed because a sandboxed
  worker cannot play audio. In the page, `new Audio(src)` with `volume` and
  `play()` is the same call, and the host has no sound service to wrap.
- `CommandsHandle.has` (0 / 0) has no use.
- `backend.ownFetch` (5 / 11) called a pack's own routes from inside the
  sandbox, and threw everywhere else. A pack calls its routes with
  `backend.fetch('/my-pack/route')`.
- `backend.sessionId` (0 / 0) has no use.
- CPU load, disk volumes, device load and temperature in
  `system.monitor` (decision 28): the backend reports none of them. The
  `/system_monitor` route the earlier contract read is not in ComfyUI.
- `LocalizationCatalog.phrases` (1 / 1): translations of exact English
  text, used where the host renders a string with no message key. The host
  has no such lookup; every translated string in the app goes through a
  key. An extra field is ignored (decision 1), so a catalog that holds
  `phrases` still registers its `messages`.
- Of the overlay's earlier members, these have no use in a stored pack:
  the events' `type`, `buttons`, `altKey`, `code`, `preventDefault` and
  `stopPropagation` (the overlay already keeps a taken pointer and key from
  the app), and the viewport's `width`, `height`, `offset` and
  `viewportToGraph` (the event carries the graph point, and `draw` the
  size).
- `MountedDialog.onKeyDown` and `DialogKeyEvent` (9 / 49). The host's
  dialog has no key handler: `showExtensionDialog` takes a component, its
  props and the frame's options (`DialogComponentProps`), none of which is a
  key listener, and a listener on the dialog's own element would reach into
  the dialog component's markup. A pack adds a `keydown` listener to the
  container in `render`, gives the container `tabIndex = -1` and focuses it
  so keys arrive before a child takes focus, and reads `event.key` and the
  modifiers from the event; the earlier `editableTarget` is
  `event.target.closest('input, textarea, select, [contenteditable]') !== null`.
- `VueSidebarTab` and `VueDialog` (0 / 0): the host would have rendered a
  pack's Vue component with its own Vue, which only the sandbox needed.
- `BadgeContribution.icon` (0 / 0) has no use. `ViewportPanelDef.destroy`
  (0 / 0) is kept, because finding A-14 sets the panel's teardown order.

## Alternatives considered

- Reach settings through `app.extensionManager.setting`, the adapter legacy
  extensions use, which takes any id without a cast. Its store,
  `workspaceStore`, imports the dialog and account services, which start
  Firebase authentication; the API would have depended on them for a settings
  read. The settings store is used directly and the id and value are cast to
  its schema in one function each, as that adapter casts them.
- Reject the promise of a storage call whose request fails, as the earlier
  contract did. The frontend's error-handling guidance asks for failure as a
  value on an extension-facing API, and a rejection is the throw it rules out.
- Watch a setting with a Vue watcher on the store's getter. It fires for an
  undeclared id too, but it clones the value on every evaluation and runs a
  reactive effect per listener; the store's own event is cheaper and is what
  the host listens to.
- Refuse a command whose key is taken. Whether a key is free depends on
  core and on the other packs installed, not on the pack's code, so the same
  pack would load on one install and throw on another.
- Copy a backend payload with `structuredClone`. It copies a Blob in a
  browser but not in the test environment, which would leave the delivery of
  previews untested, and it turns a class instance into a plain object
  without saying so. `cloneDeep` from `es-toolkit` returns what it cannot
  clone, such as a function or a DOM node, by reference, so freezing its
  result could freeze a host object.
- Give an overlay an element that takes the pointer itself
  (`pointer-events: auto`) in its regions. An element cannot let a press
  outside a region through to the graph below it, and the earlier contract
  promised that a miss reaches the graph.
- Draw overlays on every animation frame (`onCanvasFrame` alone). The graph
  draws only when something changed, and an overlay drawn with it follows
  every pan, zoom and move without work on the frames in between.
- Render a pack's viewport panels in a host component in the canvas's
  overlay slot, as badges are rendered. That is new host UI for two packs;
  the panel element is what a pack appends without the API, now owned and
  removable.
- Give the menu keyboard navigation in the API. `ContextMenu` has none for
  core's menus either; adding it here would make a pack's menu behave unlike
  the canvas's. It belongs in `ContextMenu` (see Consequences).

## Consequences

- Host lines: `actionBarButtonStore.ts` and `topbarBadgeStore.ts` each
  append `useComfyApiStore()`'s list, and `comfyApi.ts` and
  `comfyApiStore.ts` pass the lists through. `src/i18n.ts` gains
  `mergeExtensionI18n` and one loop in `loadLocale` (decision 26). Each has a
  test that fails when the line is removed.
- The settings store, the command store and the keybinding store cannot
  remove a registration, so `declare` and `register` last for the page, as
  `extension.settings` and `extension.commands` do. A removal method in each
  store would let them return a disposer.
- LiteGraph's `ContextMenu` has no keyboard navigation, for core's menus and
  a pack's alike. A ticket: "Context menus cannot be used from the keyboard:
  open a node's context menu, press the arrow keys; focus does not move into
  the menu. Suggested direction: give the menu `role="menu"`, roving focus
  with the arrow keys, Enter to choose and Escape to close."
- A pack's setting and its stored text live under the ids and paths it
  chooses. Nothing stops a pack from writing core's settings or another
  pack's files, as nothing stops it today through `api`.

## What this feature replaces or duplicates, and why

- **Copying a value.** A setting value is copied with `savedCopy` from
  `shared/savedCopy.ts`, after `isJsonValue` has checked it, so the JSON
  round trip drops nothing. A backend payload is copied with
  `frozenJsonCopy`, because the shared copy would turn a preview Blob into an
  empty object.
- **Checking a JSON value.** `isJsonValue` walks the value once. A JSON round
  trip would drop `undefined` and functions and turn `NaN` into `null`
  without saying so, which is the silent change the check exists to refuse.
  LiteGraph's `extensionPersistence.ts` has a private `isJsonValue` with the
  same finite-number, plain-object and loop rules. It is not exported, it
  has no hook for a leaf such as a Blob, which the backend payload check
  needs, and LiteGraph is not changed for the API; so the walk is written
  here.
- **Checking a message tree.** `localizationHandle.ts` walks a catalog as
  `isJsonValue` does, but takes only strings, `null` and plain objects,
  the values a vue-i18n message tree holds; `isJsonValue` would pass a
  number, a boolean or a list, which are not messages.
- **Reading the system stats.** `systemHandle.ts` reads the reply of
  `getSystemStats` field by field. The generated `zSystemStatsResponse`
  schema in `@comfyorg/ingest-types` describes the route, but no frontend
  code parses with it, and it does not carry the device fields the
  snapshot needs checked as numbers (`vram_total` and `vram_free` are
  optional there).
- **Reading a server's list.** `textFieldOfEach` reads one string field of
  each entry of a reply, for the storage and model lists, which the
  client returns unchecked.
- **Reading a pack's object.** `packArguments.ts` reads each field once with
  `Reflect.get` and checks it. `isPlainObject` from `es-toolkit` is used for
  setting values, but a definition may be any object a pack built, an
  instance of its own class included.
