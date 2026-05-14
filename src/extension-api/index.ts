/**
 * @comfyorg/extension-api — Public Extension API for ComfyUI
 *
 * This barrel is the published package entry point. Every export here is
 * part of the public contract that extension authors depend on.
 *
 * Import directly — no dependency on `window.app` at module evaluation time:
 *
 * ```ts
 * import { defineNode, defineExtension } from '@comfyorg/extension-api'
 * ```
 *
 * ## API surface overview
 *
 * | Export | Purpose |
 * |--------|---------|
 * | `defineNode` | Register a node-scoped extension (the primary entry point) |
 * | `defineExtension` | Register an app-scoped extension (init, setup, shell UI) |
 * | `onNodeMounted`, `onNodeRemoved` | Implicit-context lifecycle hooks (call inside nodeCreated) |
 * | `NodeHandle` | Controlled access to node state and events |
 * | `WidgetHandle` | Controlled access to widget state and events |
 * | `WidgetBeforeQueueEvent` | Pre-queue validation event — call `reject(msg)` to cancel |
 * | `SlotInfo` | Read-only slot snapshot |
 * | `NodeEntityId`, `WidgetEntityId`, `SlotEntityId` | Branded entity IDs |
 * | Shell UI types | `SidebarTabExtension`, `BottomPanelExtension`, `CommandManager`, etc. |
 * | Identity helpers | `NodeLocatorId`, `NodeExecutionId`, parsers, type guards |
 *
 * ## API style
 *
 * The public API is **event + getter/setter**, not signals. Vue reactivity is
 * the internal engine; extension authors never import from Vue or use
 * `ref`/`computed`/`effect` directly. State is read via methods (`getValue()`,
 * `getPosition()`), mutated via command-dispatch methods (`setValue()`,
 * `setPosition()`), and observed via typed event subscriptions (`on('executed', fn)`).
 * Read-only invariants (set at construction, never change) are exposed as
 * accessors (`get entityId`, `get type`).
 *
 * ## Barrel-file rule exception
 *
 * ComfyUI_frontend AGENTS.md rule #19 normally forbids barrel files in `/src`.
 * This barrel is the **published package entry point** — not an internal
 * re-export — and is the explicit exception documented in AGENTS.md.
 *
 * @packageDocumentation
 */

export type {
  ExtensionOptions,
  NodeExtensionOptions,
  WidgetExtensionOptions
} from './types'

export {
  defineExtension,
  defineNode,
  defineWidget
} from '@/services/extension-api-service'

export { onNodeMounted, onNodeRemoved } from './lifecycle'

export type {
  NodeHandle,
  NodeEntityId,
  SlotEntityId,
  SlotInfo,
  SlotDirection,
  NodeMode,
  Point,
  Size,
  DOMWidgetOptions,
  NodeExecutedEvent,
  NodeConnectedEvent,
  NodeDisconnectedEvent,
  NodePositionChangedEvent,
  NodeSizeChangedEvent,
  NodeModeChangedEvent,
  NodeBeforeSerializeEvent
} from './node'

export type {
  WidgetHandle,
  WidgetEntityId,
  WidgetValue,
  WidgetOptions,
  WidgetValueChangeEvent,
  WidgetOptionChangeEvent,
  WidgetPropertyChangeEvent,
  WidgetBeforeSerializeEvent,
  WidgetBeforeQueueEvent
} from './widget'

export type { Handler, AsyncHandler, Unsubscribe } from './events'

export type {
  SidebarTabExtension,
  BottomPanelExtension,
  VueExtension,
  CustomExtension,
  ToastMessageOptions,
  ToastManager,
  ExtensionManager,
  CommandManager
} from './shell'

export type { NodeLocatorId, NodeExecutionId } from './identifiers'
export {
  isNodeLocatorId,
  isNodeExecutionId,
  parseNodeLocatorId,
  createNodeLocatorId,
  parseNodeExecutionId,
  createNodeExecutionId
} from './identifiers'
