# API reference

This page is a navigable map of the published surface. The exact, exhaustive
TypeScript contract is generated from the implementation:

```sh
node scripts/magic-patch/gen_api_dts.mjs > comfy-api.d.ts
```

If a member is absent from that declaration file, it is not published. The
topic guides describe lifecycle, invariants, and recommended use; this page
collects signatures and points to those guides.

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

See [Execution and resolution](./execution.md#frontend-only-nodes).

## Application service handles

### `SettingsHandle`

- `declare(def: SettingDef): void`
- `get(id): SettingValue | undefined`
- `set(id, value): Promise<void>`
- `onChange(id, listener): Unsubscribe`

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

### `UiHandle`

- `addSidebarTab(def): Unsubscribe`
- `addTopBarBadge(def): ChromeItemHandle`
- `addActionBarButton(def): ChromeItemHandle`
- `showDialog(def): DialogHandle`
- `showMenu(def): MenuHandle`
- `prompt(def): Promise<string | undefined>`

### `BackendHandle`

- `url(route): string`
- `assetUrl(route): string`
- `sessionId(): string | undefined`
- `on(event, listener): Unsubscribe`
- `fetch(route, init?): Promise<Response>`

### `WorkflowHandle`

- `open(data: WorkflowData): Promise<void>`
- `applyTextReplacements(value: string): string`

See [Application services](./services.md).

## Implemented capabilities

This block is generated from `CAPABILITIES` in `comfyApi.ts`.

<!-- node-api-capabilities:start -->

`backend`, `commands`, `defs.define`, `defs.extend`, `defs.inputValues`,
`defs.localizedInputNames`, `defs.typeCompatibility`, `execution.node`,
`graph.nodes`, `graph.selection`, `interaction.nodeDragEnd`,
`interaction.nodeMoved`, `interaction.state`, `node.changeScope`,
`node.connectVeto`, `node.fileDrop`, `node.geometry`, `node.menu`,
`node.onPreview`, `node.onSerialize`, `node.resolve`, `node.sizeConstraints`,
`queue.disableAutoQueue`, `queue.settings`, `serialization.control`,
`settings`, `slots.connect`, `slots.connectedType`, `slots.dynamic`,
`slots.identity`, `slots.layout`, `slots.localizedName`, `slots.moveLinks`,
`slots.resolvedSource`, `slots.retype`, `slots.widgetConfig`, `storage`,
`supply.outputs`, `supply.resolved`, `ui.sidebarTab`, `viewport.changed`,
`widgets.canvas`, `widgets.create`, `widgets.height`, `widgets.hidden`,
`widgets.linked`, `widgets.mount`, `widgets.reorder`,
`widgets.textInteraction`, `widgets.typeContext`, `workflow.open`,
`workflow.textReplacements`.
<!-- node-api-capabilities:end -->

Use `comfy.capabilities()` at runtime. The generated block exists for discovery
and is checked against the implementation.

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
