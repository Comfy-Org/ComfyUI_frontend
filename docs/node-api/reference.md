# API reference

This page is a navigable map of the published surface. The exact, exhaustive
TypeScript contract is generated from the implementation:

```sh
node scripts/magic-patch/gen_api_dts.mjs > comfy-api.d.ts
```

If a member is absent from that declaration file, it is not published. The
topic guides describe lifecycle, invariants, and recommended use; this page
collects signatures and points to those guides.

Only `comfy` is a runtime entry point. The named interfaces and type aliases
below describe arguments, return values, callbacks, and snapshots reached from
that object; they are not additional global services.

## Entry point

```js
import { comfy } from '/comfy/api/v2.js'
```

See [Registration, lifecycle, and globals](./registration.md).

## `Comfy`

### Contract and identity

| Member                 | Returns                   | Purpose                                                  |
| ---------------------- | ------------------------- | -------------------------------------------------------- |
| `version`              | `string`                  | Current API `major.minor`.                               |
| `major`                | `number`                  | Breaking-change generation.                              |
| `supports(capability)` | `boolean`                 | Test a named capability.                                 |
| `require(capability)`  | `void`                    | Throw an actionable error if unavailable.                |
| `capabilities()`       | `readonly string[]`       | All capabilities supplied by the host.                   |
| `forMajor(major)`      | `Comfy`                   | Pin to a supported public major.                         |
| `sameEntity(a, b)`     | `boolean`                 | Compare handles across scopes, majors, or API instances. |
| `adopt(handle)`        | `NodeHandle \| undefined` | Re-resolve a foreign node handle into this instance.     |

### Domain roots

| Member     | Type             | Guide                                                            |
| ---------- | ---------------- | ---------------------------------------------------------------- |
| `graph`    | `GraphHandle`    | [Graphs](./graph.md)                                             |
| `defs`     | `DefRegistry`    | [Nodes and definitions](./nodes.md)                              |
| `queue`    | `QueueHandle`    | [Execution](./execution.md)                                      |
| `settings` | `SettingsHandle` | [Services](./services.md#settings)                               |
| `storage`  | `StorageHandle`  | [Services](./services.md#per-user-storage)                       |
| `ui`       | `UiHandle`       | [Services](./services.md#sidebar-tabs)                           |
| `commands` | `CommandsHandle` | [Services](./services.md#commands-keybindings-and-notifications) |
| `backend`  | `BackendHandle`  | [Services](./services.md#backend-urls-requests-and-events)       |
| `workflow` | `WorkflowHandle` | [Services](./services.md#workflow-service)                       |

### Lifecycle and observation

| Member                   | Signature                                                            |
| ------------------------ | -------------------------------------------------------------------- |
| `isInteracting`          | `() => boolean`                                                      |
| `onNodeMoved`            | `(listener: (event: NodeMoveEvent) => void) => Unsubscribe`          |
| `onNodeDragEnd`          | `(listener: (nodes: readonly NodeHandle[]) => void) => Unsubscribe`  |
| `onViewportChanged`      | `(listener: () => void) => Unsubscribe`                              |
| `onNodeChanged`          | `(listener, options?: NodeChangeOptions) => Unsubscribe`             |
| `onReady`                | `(listener: () => void) => Unsubscribe`                              |
| `onWorkflowLoaded`       | `(listener: () => void) => Unsubscribe`                              |
| `executingNode`          | `() => NodeHandle \| undefined`                                      |
| `executionNode`          | `(executionId: string) => NodeHandle \| undefined`                   |
| `onExecutingNodeChanged` | `(listener: (node: NodeHandle \| undefined) => void) => Unsubscribe` |

`onNodeDragEnd` is Nodes 2.0 only. See
[Graphs and groups](./graph.md#node-and-graph-observation).

### Observation payloads

| Type                | Fields or values                                                |
| ------------------- | --------------------------------------------------------------- |
| `NodeMoveEvent`     | `node`, `position: { x, y }`                                    |
| `NodeChangeOptions` | `scope?: 'visible' \| 'document'`                               |
| `NodeChangeScope`   | `'visible' \| 'document'`                                       |
| `TrackedProperty`   | `title`, `mode`, `color`, `bgcolor`, `shape`, or `showAdvanced` |
| `NodeChangeEvent`   | `node`, `graphId`, `property`, `from`, `to`                     |
| `Unsubscribe`       | `() => void`                                                    |

The document scope includes the root and all subgraph definitions. Since node
IDs are graph-local, key records from `NodeChangeEvent` by both `graphId` and
`node.id`.

## `DefRegistry`

| Member             | Signature or result                                                                |
| ------------------ | ---------------------------------------------------------------------------------- |
| `defineWidgetType` | `(type: string, def: WidgetTypeDef) => Unsubscribe`                                |
| `define`           | `(definition: NodeDefinition) => Unsubscribe`                                      |
| `extend`           | `(selector: DefSelector, apply: (builder: NodeDefBuilder) => void) => Unsubscribe` |
| `get`              | `(type: string) => NodeDef \| undefined`                                           |
| `all`              | `() => readonly NodeDef[]`                                                         |
| `has`              | `(type: string) => boolean`                                                        |
| `typeColor`        | `(type: string) => string`                                                         |
| `nodeColor`        | `(name: string) => NodeColor \| undefined`                                         |
| `isTypeCompatible` | `(outputType: string, inputType: string) => boolean`                               |
| `setTypeColor`     | `(type: string, color: string) => Unsubscribe`                                     |
| `refresh`          | `() => Promise<void>`                                                              |
| `onRefreshed`      | `(listener: () => void) => Unsubscribe`                                            |

`setTypeColor` accepts a type introduced by the pack and refuses a core-owned
type. Resolve palette colors when used rather than persisting or caching them.

### `NodeDefBuilder`

Configuration methods:

- `setTitle(title)`
- `setCategory(category)`
- `setExecution(execution, resolve?)`
- `setSupply(supplier)`
- `addWidget(def)`
- `hideWidget(name)`
- `addMenuItem(item)`

Behavior registration methods:

- `onCreated`
- `onExecuted`
- `onConfigured`
- `onConnectionsChanged`
- `onRemoved`
- `onResized`
- `onHover`
- `onDoubleClick`
- `onDragOver`
- `onDrop`
- `onPropertyChanged`
- `onPreview`
- `onSerialize`
- `onBeforeConnect`
- `onUnplacedLink`

The current frozen definition is available as `builder.def`.

Related types: `NodeDef`, `NodeDefinition`, `DefSelector`, `NodeCreatedEvent`,
`ExecutionResult`, `PreviewFrame`, `ConnectionChangeEvent`,
`PropertyChangeEvent`, `BeforeConnectEvent`, `UnplacedLinkEvent`,
`NodeMenuItem`, `NodeSubMenuItem`, and `NodeColor`.

### Definition data

`NodeDef` is the frozen read view returned by `get()`, `all()`, and
`builder.def`:

| Field          | Type or contents                                                                 |
| -------------- | -------------------------------------------------------------------------------- |
| `type`         | Registered type name                                                             |
| `title`        | Display title                                                                    |
| `category`     | Palette category                                                                 |
| `description`  | Backend description                                                              |
| `inputs`       | `name`, `type`, optional `localizedName`, optional combo `values`, and `options` |
| `outputs`      | `name` and `type`                                                                |
| `isOutputNode` | Whether it is an execution output                                                |
| `hidden`       | Hidden backend declarations; these are not connectable slots                     |
| `source`       | Supplying pack, when reported by the backend                                     |

`NodeDefinition` declares a frontend-owned type. It requires `type` and may
set `title`, `category`, `description`, `inputs`, `outputs`, `widgets`,
`execution`, `resolve`, and `supply`. It can also declare `onCreated`,
`onExecuted`, `onConfigured`, `onConnectionsChanged`, `onPropertyChanged`,
`onDragOver`, `onDrop`, `onRemoved`, and `onSerialize` callbacks directly.

`DefSelector` is a type string, string array, regular expression, predicate
over `NodeDef`, or `{ category: string | RegExp }`.

### Definition callback payloads

| Type                    | Fields and behavior                                                       |
| ----------------------- | ------------------------------------------------------------------------- |
| `NodeCreatedEvent`      | `restored`, `loading`                                                     |
| `ExecutionResult`       | `images`, `text`, and passthrough `raw`                                   |
| `PreviewFrame`          | `blob`, temporary object `url`                                            |
| `ConnectionChangeEvent` | `side`, `index`, `connected`, optional `peerNodeId`, optional `peerIndex` |
| `PropertyChangeEvent`   | `name`, `value`, `previous`, `setValue(value)`, `reject()`                |
| `BeforeConnectEvent`    | `side`, `index`, optional `peerNodeId`, `peerIndex`, and `peerType`       |
| `UnplacedLinkEvent`     | `side`, `peerNodeId`, `peerIndex`, `type`, `replaceExisting`              |

`NodeMenuItem` has a string or node-dependent `label`, optional `when`,
optional `run`, optional one-level `items`, and optional numeric `order`.
`NodeSubMenuItem` contains `label` and `run(node)`. `NodeColor` contains
`color`, `bgColor`, and `groupColor`.

See [Nodes and definitions](./nodes.md).

## `GraphHandle`

### Lookup and inspection

| Member               | Result                          |
| -------------------- | ------------------------------- |
| `id`                 | `string`                        |
| `node(id)`           | `NodeHandle \| undefined`       |
| `nodes()`            | `readonly NodeHandle[]`         |
| `nodesOfType(type)`  | `readonly NodeHandle[]`         |
| `links()`            | `readonly LinkInfo[]`           |
| `groups()`           | `readonly GroupHandle[]`        |
| `selection()`        | `readonly NodeHandle[]`         |
| `root()`             | `GraphScopeHandle \| undefined` |
| `subgraphs()`        | `readonly GraphScopeHandle[]`   |
| `resolvedSupplies()` | `readonly ResolvedSupply[]`     |
| `nodeAt(point)`      | `NodeHandle \| undefined`       |
| `pointerPosition()`  | `Point \| undefined`            |
| `version`            | opaque `number` change token    |
| `cacheSize`          | diagnostic `number`             |

### Mutation and view

| Member      | Signature or result                                                   |
| ----------- | --------------------------------------------------------------------- |
| `add`       | `(type: string, init?: NodeInit) => NodeHandle`                       |
| `duplicate` | `(id: string, position?: Point) => NodeHandle \| undefined`           |
| `replace`   | `(id: string, type: string) => NodeHandle \| undefined`               |
| `remove`    | `(id: string) => boolean`                                             |
| `select`    | `(nodes: readonly NodeHandle[], options?: { add?: boolean }) => void` |
| `centerOn`  | `(node: NodeHandle) => void`                                          |
| `setZoom`   | `(scale: number) => void`                                             |
| `batch`     | `<T>(mutations: () => T) => T`                                        |

### `GraphScopeHandle`

Read-only graph scope with `id`, optional `name`, `nodes()`, `node(id)`,
`groups()`, and `resolvedSupplies()`.

### `GroupHandle`

Provides `id`, title and color getter/setters, `nodes()`, `getBounds()`, and
`centerOn()`.

`NodeInit` accepts optional `title` and `position`. `Point` is `{ x, y }`,
`Size` is `{ width, height }`, and `Bounds` is `{ x, y, width, height }`.

See [Graphs and groups](./graph.md).

## `NodeHandle`

Every node handle has `isDeleted`, `id`, `graphId`, `type`, and `comfyClass`.

### State

| Read                                   | Write                             |
| -------------------------------------- | --------------------------------- |
| `getTitle()`                           | `setTitle(title)`                 |
| `getMode()`                            | `setMode(mode)`                   |
| `isCollapsed()`                        | `setCollapsed(collapsed)`         |
| `isPinned()`                           | `setPinned(pinned)`               |
| `getColor()`                           | `setColor(color)`                 |
| `getBgColor()`                         | `setBgColor(color)`               |
| `getShape()`                           | `setShape(shape)`                 |
| `getProperty(key)` / `getProperties()` | `setProperty(key, value)`         |
| `isSerializingWidgets()`               | `setSerializeWidgets(serialize)`  |
| `getPosition()`                        | `setPosition(point)`              |
| `getSize()`                            | `setSize(size)`                   |
| `getSizeConstraints()`                 | `setSizeConstraints(constraints)` |

### Other members

- `getBounds()`
- `getSlotPosition(side, index)`
- `getScreenRect()`
- `getOutputImages()`
- `getDisplayedImageIndex()`
- `addBadge(badge)`
- `snapshot()`
- `remove()`
- `inputs`, `outputs`, and `widgets`

Related types: `NodeMode`, `NodeShape`, `NodeSnapshot`, `BadgeDef`, `Point`,
`Size`, `Bounds`, and `SizeConstraints`.

### Node data types

| Type              | Shape or values                                                             |
| ----------------- | --------------------------------------------------------------------------- |
| `NodeMode`        | `always`, `never`, `bypass`, `on-event`, or `on-trigger`                    |
| `NodeShape`       | `default`, `box`, `round`, `circle`, or `card`                              |
| `BadgeDef`        | `text`, optional `color`, `bgColor`, and `onClick()`                        |
| `SizeConstraints` | Optional `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, and `autoHeight` |
| `NodeSnapshot`    | Identity, title, mode/flags/colors/shape, `position`, and `size`            |

Every live handle implements `HandleCommon`, whose `isDeleted` flag remains
safe to read after removal. Other reads return inert absence and mutating a
deleted handle throws unless the requested end state is already achieved by an
idempotent removal or disconnect.

See [Nodes and definitions](./nodes.md).

## Slots and links

### `SlotCollection<THandle>`

| Member                      | Result                                             |
| --------------------------- | -------------------------------------------------- |
| `length`                    | `number`                                           |
| `get(ref)`                  | handle or `undefined`; throws on an ambiguous name |
| `byId(id)`                  | handle or `undefined`                              |
| `byName(name)`              | handle or `undefined`                              |
| `at(index)`                 | handle or `undefined`                              |
| `all()`                     | frozen handle array                                |
| `ids()`                     | frozen `SlotId` array                              |
| `names()`                   | frozen string array                                |
| `add(name, type, options?)` | new handle                                         |
| `remove(ref)`               | `boolean`                                          |
| `reorder(names)`            | `void`                                             |

Collections are iterable.

### `InputSlotHandle`

Identity and state: `id`, `index`, `name`, `type`, `label`, `isConnected`,
`connectedType`, and `isWidgetInput`.

Methods: `widgetConfig()`, `mergeWidgetConfig(config)`, `link()`, `source()`,
`resolvedSource()`, `disconnect()`, `modify(patch)`, and `snapshot()`.

### `OutputSlotHandle`

Identity and state: `id`, `index`, `name`, `type`, `label`, and `isConnected`.

Methods: `links()`, `targets()`, `connectTo(targetNodeId, input)`,
`disconnect(targetNodeId?)`, `modify(patch)`, `moveLinksTo(target)`, and
`snapshot()`.

Related types: `SlotId`, `SlotRef`, `SlotType`, `SlotShape`, `SlotOptions`,
`SlotPatch`, `InputSlotPatch`, `SlotSnapshot`, `LinkInfo`, `InputWidgetConfig`,
and `ResolvedInputSource`.

### Slot and link data

| Type                | Shape or values                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `SlotId`            | Stable branded string                                                                                      |
| `SlotRef`           | Slot ID, exact name, or explicit `{ index }`                                                               |
| `SlotType`          | String or string array; arrays normalize to the comma-separated wire type                                  |
| `SlotShape`         | `default`, `optional`, `list`, or `directional`                                                            |
| `SlotDirection`     | `none`, `up`, `down`, `left`, `right`, or `center`                                                         |
| `SlotPosition`      | `{ x, y }` relative to the node body                                                                       |
| `InputWidgetConfig` | String or combo-array `type`, plus optional frozen `options`                                               |
| `LinkInfo`          | `id`, `sourceNodeId`, `sourceSlotId`, `targetNodeId`, `targetSlotId`, `type`, `sourceIndex`, `targetIndex` |

`SlotOptions` configures a newly added slot with `shape`, `localizedName`,
`position`, `direction`, `widget`, and `widgetConfig`. `SlotPatch` can change
`name`, `label`, `localizedName`, `type`, `position`, `direction`, `color`,
`colorWhenUnconnected`, and `shape`; `InputSlotPatch` adds `widget` and
`widgetConfig`. Use `null` where the declaration says it restores the host
default.

`SlotSnapshot` contains stable identity plus current index, name, type, label,
localized name, position, direction, shape, and connection state.
`ResolvedInputSource` is an output (`graphId`, `nodeId`, `outputIndex`), a
literal value, or an omission with a reason.

See [Slots and links](./slots.md).

## Widgets

### `WidgetCollection`

| Member                                 | Result                      |
| -------------------------------------- | --------------------------- |
| `length`                               | `number`                    |
| `get(name)` / `at(index)`              | `WidgetHandle \| undefined` |
| `all()` / `names()`                    | frozen snapshots            |
| `reorder(names)` / `move(name, index)` | `void`                      |
| `add(def)`                             | `WidgetHandle`              |
| `mount(def)`                           | `WidgetHandle`              |
| `canvas(def)`                          | `CanvasHandle`              |
| `remove(name)`                         | `boolean`                   |

The collection is iterable.

### `WidgetHandle`

Every widget handle has `isDeleted`, `name`, and `widgetType`.

| Area          | Members                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------- |
| Value         | `getValue()`, `setValue(value)`                                                               |
| Relationships | `linked()`, `setLinked(names)`                                                                |
| Visibility    | `isHidden()`, `setHidden(hidden)`                                                             |
| Options       | `getOptions()`, `setOption(key, value)`, `setLabel(label)`                                    |
| State         | `isDisabled()`, `setDisabled(disabled)`, `isSerialized()`                                     |
| Layout        | `getHeight()`, `setHeight(px)`                                                                |
| Events        | `on('change' \| 'removed' \| 'activate' \| 'textInteraction' \| 'beforeSerialize', listener)` |

Related types: `WidgetValue`, `WidgetOptions`, `WidgetDef`,
`WidgetSerializeEvent`, `MountDef`, `MountedValue`, `CanvasDef`, `CanvasHandle`,
`CanvasPointerEvent`, `CanvasTheme`, `WidgetTypeDef`, `WidgetTypeValue`,
`WidgetTypeContext`, and the `WidgetText*` event types.

### Widget declarations and mounted values

| Type           | Important fields or methods                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `WidgetDef`    | `type`, `name`, optional value/options/disabled/hidden/serialize fields            |
| `MountDef`     | `name`, `render`, optional teardown/layout/visibility/serialization/default fields |
| `MountedData`  | String, number, boolean, object, or `null`                                         |
| `MountedValue` | `get()`, `set(value)`, `onChange(listener)`                                        |
| `CanvasHandle` | `widget`, `redraw()`                                                               |

`WidgetValue` also allows `undefined`. `WidgetOptions` is an open, frozen
record. Its named common fields are `on`, `off`, `max`, `min`, `precision`,
`read_only`, `step`, `step2`, `multiline`, `property`, `socketless`,
`canvasOnly`, `hideInPanel`, `nodeType`, `serialize`, `values`, `iconClass`,
`disabled`, `useGrouping`, `placeholder`, `showThumbnails`,
`showItemNavigators`, and `hidden`. Read with `getOptions()` and update through
`setOption()`.

`WidgetSerializeEvent` contains `context`, the unmodified `value`, and
`setSerializedValue(value)`. Context is `workflow`, `prompt`, or `embedded`.

### Canvas widget types

`CanvasDef` requires `name` and `draw(context, size, theme, value)`. It may set
`height`, value/serialization fields, and `onPointerDown`, `onPointerMove`,
`onPointerUp`, and `onContextMenu` handlers. `CanvasPointerEvent` supplies
widget-relative `x`, `y`, and the original `PointerEvent`.

`CanvasTheme` supplies `surface`, `surfaceHovered`, `border`, `text`, and
`textSecondary`. It is resolved afresh for each draw, so do not cache it.

### Widget type registration

`WidgetTypeData` is string, number, boolean, object, or `null`.
`WidgetTypeValue` provides `get`, `set`, and `onChange`. `WidgetTypeContext`
provides a frozen `getOptions()` snapshot and `onNodeReady(listener)`.

`WidgetTypeDef` may declare `defaultValue`, `height`, `minWidth`, `minHeight`,
and `serialize`, and must implement:

```ts
interface WidgetTypeDef {
  render(
    container: HTMLElement,
    value: WidgetTypeValue,
    name: string,
    context: WidgetTypeContext
  ): Unsubscribe | void
}
```

### Host text-editor events

All `WidgetTextInteractionEvent` variants contain the current `value`, a
`WidgetTextSelection` (`start`, `end`), `menuEvent`, `setValue()`, and
`focus()`:

| Variant                | Additional fields                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `WidgetTextInputEvent` | `kind: 'input' \| 'selection'`                                                                                          |
| `WidgetTextWheelEvent` | `kind: 'wheel'`, `deltaY`, `ctrlKey`, `preventDefault()`                                                                |
| `WidgetTextKeyEvent`   | `kind: 'keydown'`, `key`, `ctrlKey`, `altKey`, `shiftKey`, `metaKey`, `repeat`, `preventDefault()`, `stopPropagation()` |

`WidgetTextEventBase` is the shared portion of those variants.

See [Widgets](./widgets.md).

## `QueueHandle`

| Member                         | Signature or result                                             |
| ------------------------------ | --------------------------------------------------------------- |
| `run`                          | `(options?: RunOptions) => Promise<boolean>`                    |
| `onBeforeRun`                  | `(listener: () => (() => void) \| void) => Unsubscribe`         |
| `onAfterRun`                   | `(listener: (event: RunSubmittedEvent) => void) => Unsubscribe` |
| `onRejected`                   | `(listener: (event: RunRejectedEvent) => void) => Unsubscribe`  |
| `pending`                      | `() => number`                                                  |
| `onPendingChanged`             | `(listener: (pending: number) => void) => Unsubscribe`          |
| `interrupt`                    | `() => Promise<void>`                                           |
| `onInterrupted`                | `(listener: () => void) => Unsubscribe`                         |
| `autoQueueMode`                | `() => AutoQueueMode`                                           |
| `setAutoQueueMode`             | `(mode: AutoQueueMode) => void`                                 |
| `batchCount` / `setBatchCount` | read or change the host batch count                             |
| `disableAutoQueue`             | `() => void`                                                    |
| `guard`                        | `(check: () => boolean \| Promise<boolean>) => Unsubscribe`     |

Related types: `RunOptions`, `RunSubmittedEvent`, `RunSubmission`,
`RunRejectedEvent`, `RunRejectedNode`, `RunRejectionError`, and `AutoQueueMode`.

### Queue payloads

| Type                | Fields or values                                                        |
| ------------------- | ----------------------------------------------------------------------- |
| `RunOptions`        | Optional `nodes` and `batch`                                            |
| `RunSubmittedEvent` | Accepted `promptIds`, optional `submissions`, rejected submission count |
| `RunSubmission`     | `promptId`, executable `nodeCount`                                      |
| `RunRejectionError` | `type`, `message`, `details`, optional `inputName`                      |
| `RunRejectedNode`   | `nodeId`, `nodeType`, `errors`                                          |
| `RunRejectedEvent`  | Optional HTTP `status`, top-level `error`, and per-node `nodeErrors`    |
| `AutoQueueMode`     | `disabled`, `change`, or `instant`                                      |

See [Execution](./execution.md).

## Resolution and supply

| Type                               | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `Resolver`                         | Maps a frontend node's own output names to `OutputResolution`. |
| `OutputResolution`                 | Omit, forward to an input, or emit a literal.                  |
| `ResolveView` / `ResolvedNodeView` | Frozen data visible to a resolver.                             |
| `Supplier`                         | Offers edges into unconnected inputs in the same graph.        |
| `SupplyView` / `UnconnectedInput`  | Frozen matching data visible to a supplier.                    |
| `SuppliedEdge`                     | One offered edge and optional priority.                        |
| `ResolvedSupply`                   | One winning, fully resolved edge.                              |
| `ResolvedSource`                   | Final output, literal, or omission.                            |

### Resolver view

`InputRef` is `{ nodeId, input }`. `OutputResolution` is one of
`{ omit: true }`, `{ forwardTo: InputRef }`, or `{ literal: WidgetValue }`.
`ResolvedSource` is the corresponding final output, literal, or omission with
a reason.

`ResolvedNodeView` contains `id`, `type`, frozen `properties`, `groups`, raw
numeric `mode`, `color`, `inputs`, `outputs`, `widgetValue(name)`, and
`input(ref)`. Its `OwnInput` entries contain index/name/label/type, connection
state, resolved `connectedType`, and optional `sourceNodeId`; `OwnOutput`
contains index/name/label/type. `GroupMembership` contains `id` and `title`.

`ResolveView` adds `self` and `nodesOfType(type)`. A `Resolver` returns a record
keyed by its own output names.

### Supplier view

`UnconnectedInput` contains `nodeId`, `nodeType`, `input`, `name`, `type`,
display `label`, `isWidgetInput`, `nodeTitle`, `nodeMode`, `nodeColor`,
`nodeGroups`, and frozen `nodeProperties`. `SupplyView` exposes `self`,
`nodesOfType()`, and `unconnectedInputs()`.

Each `SuppliedEdge` contains `to: InputRef`, an optional `priority`, and `from`
as the supplier's output, a literal, or one of the supplier's forwarded inputs.
`ResolvedSupply` contains `supplierNodeId`, `to`, and the final `from` source.

See [Execution and resolution](./execution.md#frontend-only-nodes).

## Application service handles

### `SettingsHandle`

- `declare(def: SettingDef): void`
- `get(id): SettingValue | undefined`
- `set(id, value): Promise<void>`
- `onChange(id, listener): Unsubscribe`

`SettingValue` is string, number, boolean, or a readonly string array.
`SettingDef` contains `id`, `name`, declarative `type`, `defaultValue`, and
optional `tooltip`, `category`, `options`, `attrs`, and `onChange`.
`SettingOption` is a string or `{ value, label }`; `SettingAttrs` contains
optional `min`, `max`, and `step`.

### `StorageHandle`

- `list(namespace): Promise<readonly string[]>`
- `get(name): Promise<string | undefined>`
- `set(name, value): Promise<void>`
- `remove(name): Promise<void>`

### `CommandsHandle`

- `register(def: CommandDef): void`
- `notify(def: NotifyDef): void`
- `run(id): Promise<void>`
- `has(id): boolean`

`CommandDef` contains namespaced `id`, static or dynamic `label`, `run`, an
optional `KeyCombo`, and optional canvas scope. `KeyCombo` contains `key` plus
optional Ctrl/Alt/Shift/Meta flags. `NotifyDef` contains `summary` and optional
`severity`, `detail`, and lifetime in milliseconds.

### `UiHandle`

- `addSidebarTab(def): Unsubscribe`
- `addTopBarBadge(def): ChromeItemHandle`
- `addActionBarButton(def): ChromeItemHandle`
- `showDialog(def): DialogHandle`
- `showMenu(def): MenuHandle`
- `prompt(def): Promise<string | undefined>`

Sidebar definitions share `SidebarTabBase` (`id`, `title`, optional `icon` and
`tooltip`). `MountedSidebarTab` adds `render(container)` and optional
`destroy()`; `VueSidebarTab` adds a bundled `VueComponent`. `SidebarTabDef` is
the union.

Dialogs share `DialogBase` (`key`, optional `title`). `MountedDialog` adds
`render(container)` and optional `destroy()`; `VueDialog` adds `component` and
optional `props`. `DialogDef` is the union. `DialogHandle.close()` closes it.

`PromptDef` contains `label`, optional initial `value`, and optional
`placeholder`. `MenuDef` contains an anchoring `MouseEvent`, optional `title`,
and `MenuItemDef` entries. A menu item has `label`, optional `disabled`, and
either `submenu` or `run()`. `MenuHandle.close()` closes it.

`BadgeContribution` contains namespaced `id`, `text`, and optional label,
variant, icon, and tooltip. `ButtonContribution` contains namespaced `id`,
icon, optional label/tooltip, and `run(event)`. Their `ChromeItemHandle` can
`update()` all fields except identity or `remove()` the contribution.

### `BackendHandle`

- `url(route): string`
- `assetUrl(route): string`
- `sessionId(): string | undefined`
- `on(event, listener): Unsubscribe`
- `fetch(route, init?): Promise<Response>`

### `WorkflowHandle`

- `open(data: WorkflowData): Promise<void>`
- `applyTextReplacements(value: string): string`

`WorkflowData` is parsed workflow JSON represented as a readonly record.

See [Application services](./services.md).

## Implemented capabilities

This block is generated from `CAPABILITIES` in `comfyApi.ts`.

<!-- node-api-capabilities:start -->

`backend`, `commands`, `commands.playSound`, `defs.define`, `defs.extend`,
`defs.inputValues`, `defs.localizedInputNames`, `defs.typeCompatibility`,
`execution.node`, `graph.nodes`, `graph.selection`,
`interaction.nodeDragEnd`, `interaction.nodeMoved`, `interaction.state`,
`node.changeScope`, `node.connectVeto`, `node.fileDrop`, `node.geometry`,
`node.menu`, `node.onPreview`, `node.onSerialize`, `node.resolve`,
`node.sizeConstraints`, `queue.disableAutoQueue`, `queue.settings`,
`serialization.control`, `settings`, `slots.connect`, `slots.connectedType`,
`slots.dynamic`, `slots.identity`, `slots.layout`, `slots.localizedName`,
`slots.moveLinks`, `slots.resolvedSource`, `slots.retype`,
`slots.widgetConfig`, `storage`, `supply.outputs`, `supply.resolved`,
`system.monitor`, `ui.sidebarTab`, `viewport.changed`, `widgets.canvas`,
`widgets.create`, `widgets.height`, `widgets.hidden`, `widgets.linked`,
`widgets.mount`, `widgets.reorder`, `widgets.textInteraction`,
`widgets.typeContext`, `workflow.open`, `workflow.textReplacements`.
<!-- node-api-capabilities:end -->

Use `comfy.capabilities()` at runtime. The generated block exists for discovery
and is checked against the implementation.

## Host-plumbing declarations

The generated declaration file is assembled from exported TypeScript
declarations, so it also contains a few types used to connect this layer to the
host: `PropSpec`, `HandleSpec`, `HandleToken`, `NodeCollections`,
`NodeMoveSource`, `NodeDragEndSource`, and `ResolveOptions`. They are not
reachable services or extension registration points. Packs should use
`HandleCommon.isDeleted`, `comfy.sameEntity()`, the public observation methods,
and slot handles instead of constructing those plumbing objects.

For completeness, `PropSpec` contains `get`, optional `set`, and
`readonlyHint`; `HandleSpec` contains `kind`, `props`, optional `methods`,
`idMethods`, and `identityProps`; `HandleToken` is `{ kind, id }`; and
`ResolveOptions.namedSlotsAvailable` controls host-side transitional slot
lookup. `NodeCollections` and the two movement-source types are host providers,
not pack callbacks.

## Errors and absence

Expected lookup absence returns `undefined` or `false` where the signature says
so. Invalid operations throw named `Error` subclasses, including:

- `ComfyApiError` for general contract failures;
- `ComfyDeletedError` for a write through a deleted handle;
- `ComfyReadonlyError` for assigning a read-only handle member;
- `ComfyAmbiguousSlotError` for ambiguous explicit slot lookup;
- `ComfyUnsupportedError` for a failed capability requirement.

The error constructors are not currently exported by `/comfy/api/v2.js`; code
can inspect ordinary `Error` fields but should primarily avoid expected failures
with capability probes, lookup checks, and `isDeleted`.

## Source files

| Domain               | Implementation                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Root and versioning  | `src/platform/nodeApi/comfyApi.ts`                                                                                   |
| Definitions          | `src/platform/nodeApi/defsRegistry.ts`                                                                               |
| Graph and groups     | `src/platform/nodeApi/graphHandle.ts`, `groupHandle.ts`                                                              |
| Nodes                | `src/platform/nodeApi/nodeHandle.ts`                                                                                 |
| Slots                | `src/platform/nodeApi/slotHandle.ts`, `slotRef.ts`                                                                   |
| Widgets              | `src/platform/nodeApi/widgetHandle.ts`, `widgetTypes.ts`, `widgetTextInteraction.ts`                                 |
| Queue and resolution | `src/platform/nodeApi/queueHandle.ts`, `resolution.ts`                                                               |
| Services             | `settingsHandle.ts`, `storageHandle.ts`, `commandsHandle.ts`, `uiHandle.ts`, `backendHandle.ts`, `workflowHandle.ts` |

Every domain has focused unit tests beside its implementation.
