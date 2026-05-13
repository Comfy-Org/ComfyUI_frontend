import { AsyncHandler, Handler, Unsubscribe } from './events'
import { WidgetHandle, WidgetOptions } from './widget'
import { NodeEntityId } from '../world/entityIds'
export type { NodeEntityId }
/**
 * A 2D point as `[x, y]`.
 *
 * @stability stable
 */
export type Point = [x: number, y: number]
/**
 * A 2D size as `[width, height]`.
 *
 * @stability stable
 */
export type Size = [width: number, height: number]
/**
 * LiteGraph node execution mode.
 *
 * - `0` — Always execute.
 * - `1` — Never execute (muted).
 * - `2` — Bypass (passthrough).
 * - `3` — Execute once.
 * - `4` — Execute on trigger.
 *
 * @stability stable
 */
export type NodeMode = 0 | 1 | 2 | 3 | 4
/**
 * Direction of a slot on a node.
 *
 * @stability stable
 */
export type SlotDirection = 'input' | 'output'
/**
 * Read-only snapshot of a single slot (input or output) on a node.
 *
 * @stability stable
 */
export interface SlotInfo {
  /** Branded entity ID for this slot. */
  readonly entityId: SlotEntityId
  /** Slot name as declared in `INPUT_TYPES` or `addInput`/`addOutput`. */
  readonly name: string
  /** Slot type string (e.g. `'IMAGE'`, `'LATENT'`, `'*'`). */
  readonly type: string
  /** Whether this is an input or output slot. */
  readonly direction: SlotDirection
  /** The node this slot belongs to. */
  readonly nodeEntityId: NodeEntityId
}
/**
 * Branded entity ID for slots. Prevents mixing slot IDs with node/widget IDs.
 *
 * @stability stable
 */
export type SlotEntityId = number & {
  readonly __brand: 'SlotEntityId'
}
/**
 * Payload for `node.on('executed', handler)`.
 *
 * Replaces the v1 `nodeType.prototype.onExecuted` patching pattern.
 *
 * @stability stable
 * @example
 * ```ts
 * node.on('executed', (e) => {
 *   const text = e.output['text'] as string[]
 *   previewWidget.setValue(text.join('\n'))
 * })
 * ```
 */
export interface NodeExecutedEvent {
  /** The backend execution output for this node. Shape varies by node type. */
  readonly output: Record<string, unknown>
}
/**
 * Payload for `node.on('connected', handler)`.
 *
 * Replaces `nodeType.prototype.onConnectInput` / `onConnectOutput` and
 * `nodeType.prototype.onConnectionsChange` patching.
 *
 * @stability stable
 */
export interface NodeConnectedEvent {
  /** The local slot that was connected. */
  readonly slot: SlotInfo
  /** The remote slot on the other node. */
  readonly remote: SlotInfo
}
/**
 * Payload for `node.on('disconnected', handler)`.
 *
 * @stability stable
 */
export interface NodeDisconnectedEvent {
  /** The local slot that was disconnected. */
  readonly slot: SlotInfo
}
/**
 * Payload for `node.on('positionChanged', handler)`.
 *
 * @stability stable
 */
export interface NodePositionChangedEvent {
  /** The new position. */
  readonly pos: Point
}
/**
 * Payload for `node.on('sizeChanged', handler)`.
 *
 * @stability stable
 */
export interface NodeSizeChangedEvent {
  /** The new size. */
  readonly size: Size
}
/**
 * Payload for `node.on('modeChanged', handler)`.
 *
 * @stability stable
 */
export interface NodeModeChangedEvent {
  /** The new execution mode. */
  readonly mode: NodeMode
}
/**
 * Payload for `node.on('beforeSerialize', handler)`.
 *
 * The node-level equivalent of `WidgetBeforeSerializeEvent`. Replaces both
 * `node.onSerialize` and `nodeType.prototype.serialize` patching patterns
 * (v1 S2.N6, S2.N15 touch-points).
 *
 * Mutate `event.data` in place to append extra fields (replaces `onSerialize`).
 * Call `event.replace(fn)` to wrap the entire serialized object (replaces
 * `prototype.serialize = function(){ const r = orig.call(this); … }`).
 *
 * @stability experimental
 * @example
 * ```ts
 * // Append a field
 * node.on('beforeSerialize', (e) => {
 *   e.data['my_extra'] = computeExtra()
 * })
 *
 * // Wrap the serialized object
 * node.on('beforeSerialize', (e) => {
 *   e.replace((orig) => ({ ...orig, wrapped: true }))
 * })
 * ```
 */
export interface NodeBeforeSerializeEvent {
  /** Which serialization path triggered this. */
  readonly context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
  /**
   * The mutable serialized node object. Mutate in place to append fields.
   * Type intentionally loose — the exact shape is `ISerialisedNode`.
   */
  readonly data: Record<string, unknown>
  /**
   * Replace the serialized object by providing a transform function.
   * `fn` receives the current `data` and should return the replacement.
   * Calling this multiple times chains: each call's `fn` receives the
   * previous call's output.
   */
  replace(fn: (orig: Record<string, unknown>) => Record<string, unknown>): void
}
/**
 * Options for `NodeHandle.addDOMWidget()`.
 *
 * @stability experimental
 */
export interface DOMWidgetOptions {
  /** Unique widget name within this node. */
  name: string
  /** The DOM element to embed in the node widget area. */
  element: HTMLElement
  /** Reserved height in pixels. Defaults to `element.offsetHeight` at mount time. */
  height?: number
}
/**
 * Controlled surface for node access. Reads query the ECS World; writes
 * dispatch commands. Events are Vue-reactive watches on World components.
 *
 * @stability stable
 * @example
 * ```ts
 * import { defineNodeExtension } from '@comfyorg/extension-api'
 *
 * export default defineNodeExtension({
 *   name: 'my-size-enforcer',
 *   nodeTypes: ['MyCustomNode'],
 *
 *   nodeCreated(node) {
 *     const [w, h] = node.getSize()
 *     node.setSize([Math.max(w, 300), Math.max(h, 200)])
 *
 *     node.on('executed', (e) => {
 *       console.log('output:', e.output)
 *     })
 *   }
 * })
 * ```
 */
export interface NodeHandle {
  /**
   * Stable entity ID for this node. Branded to prevent mixing with
   * `WidgetEntityId` at compile time.
   *
   * @stability stable
   */
  readonly entityId: NodeEntityId
  /**
   * The LiteGraph node type string (e.g. `'KSampler'`).
   * Read-only invariant: set at construction, never changes.
   *
   * @stability stable
   */
  readonly type: string
  /**
   * The ComfyUI backend class name (e.g. `'KSampler'`).
   * Equal to `type` for most nodes; differs for reroute/virtual nodes.
   * Read-only invariant.
   *
   * @stability stable
   */
  readonly comfyClass: string
  /**
   * Returns the node's current canvas position as `[x, y]`.
   *
   * @stability stable
   */
  getPosition(): Point
  /**
   * Moves the node to a new canvas position. Dispatches a `MoveNode` command.
   *
   * @stability stable
   */
  setPosition(pos: Point): void
  /**
   * Returns the node's current size as `[width, height]`.
   *
   * @stability stable
   */
  getSize(): Size
  /**
   * Resizes the node. Dispatches a `ResizeNode` command.
   *
   * @stability stable
   */
  setSize(size: Size): void
  /**
   * Returns the node's display title. Defaults to the node type string.
   *
   * @stability stable
   */
  getTitle(): string
  /**
   * Sets the node's display title. Dispatches a `SetNodeVisual` command.
   *
   * @stability stable
   */
  setTitle(title: string): void
  /**
   * Returns `true` if the node is currently selected on the canvas.
   *
   * @stability stable
   */
  isSelected(): boolean
  /**
   * Returns the node's current execution mode.
   *
   * @stability stable
   */
  getMode(): NodeMode
  /**
   * Sets the node's execution mode. Dispatches a `SetNodeMode` command.
   *
   * @stability stable
   */
  setMode(mode: NodeMode): void
  /**
   * Returns a per-node-instance property by key.
   *
   * In v2, prefer routing persistent state through widget values or
   * `beforeSerialize` events. `node.properties` is kept as a migration shim
   * for v1 extensions that used it for per-instance widget config (e.g. min/max).
   *
   * @stability stable
   */
  getProperty<T = unknown>(key: string): T | undefined
  /**
   * Returns a copy of all per-node-instance properties.
   *
   * @stability stable
   */
  getProperties(): Record<string, unknown>
  /**
   * Sets a per-node-instance property. Dispatches a `SetNodeProperty` command.
   *
   * In v2, prefer `widget.setOption(key, value)` for widget-scoped per-instance
   * config (it persists to the `widget_options` sidecar in the workflow JSON).
   *
   * @stability stable
   */
  setProperty(key: string, value: unknown): void
  /**
   * Returns a `WidgetHandle` for the named widget, or `undefined` if no such
   * widget exists on this node.
   *
   * @stability stable
   * @example
   * ```ts
   * const steps = node.widget('steps')
   * if (steps) steps.setValue(20)
   * ```
   */
  widget(name: string): WidgetHandle | undefined
  /**
   * Returns all widgets on this node as `WidgetHandle` instances.
   *
   * @stability stable
   */
  widgets(): readonly WidgetHandle[]
  /**
   * Adds a new widget to this node.
   *
   * @param type - Widget type string (e.g. `'INT'`, `'STRING'`, `'COMBO'`).
   * @param name - Unique widget name on this node.
   * @param defaultValue - Initial value.
   * @param options - Optional type-specific options.
   * @returns The new `WidgetHandle`.
   * @stability stable
   */
  addWidget(
    type: string,
    name: string,
    defaultValue: unknown,
    options?: Partial<WidgetOptions>
  ): WidgetHandle
  /**
   * Adds a DOM-backed widget to this node.
   *
   * Replaces the v1 `node.addDOMWidget(name, type, element, opts)` pattern.
   * The runtime automatically:
   * - Reserves node height for the element (via auto-computeSize integration).
   * - Removes the element from the DOM when the node is removed.
   * - Includes the widget in `NodeHandle.widgets()`.
   *
   * Use `WidgetHandle.setHeight(px)` to resize the reservation after initial mount.
   *
   * @param opts.name - Unique widget name on this node.
   * @param opts.element - The DOM element to embed.
   * @param opts.height - Initial reserved height in pixels. Defaults to `element.offsetHeight`.
   * @returns A `WidgetHandle` for the registered DOM widget.
   * @stability experimental
   */
  addDOMWidget(opts: DOMWidgetOptions): WidgetHandle
  /**
   * Returns all input slots on this node.
   *
   * @stability stable
   */
  inputs(): readonly SlotInfo[]
  /**
   * Returns all output slots on this node.
   *
   * @stability stable
   */
  outputs(): readonly SlotInfo[]
  /**
   * Subscribe to node removal (graph deletion, not subgraph promotion).
   *
   * Replaces the v1 `nodeType.prototype.onRemoved` patching pattern.
   * Does NOT fire on subgraph promotion — the node's entity ID is preserved
   * across promotion (see D9 Phase A notes and D12).
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(event: 'removed', handler: Handler<void>): Unsubscribe
  /**
   * Subscribe to backend execution completion for this node.
   *
   * Replaces the v1 `nodeType.prototype.onExecuted` patching pattern (the
   * most widely used anti-pattern per R4-P3; 5+ confirmed repos).
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(event: 'executed', handler: Handler<NodeExecutedEvent>): Unsubscribe
  /**
   * Subscribe to workflow hydration (node loaded from a saved workflow).
   *
   * Replaces the v1 `nodeType.prototype.onConfigure` / `loadedGraphNode`
   * patterns. Fires after all widget values are restored from the workflow JSON.
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(event: 'configured', handler: Handler<void>): Unsubscribe
  /**
   * Subscribe to slot connection events.
   *
   * Replaces `nodeType.prototype.onConnectInput`, `onConnectOutput`, and
   * `onConnectionsChange` patching patterns (R4-P4: six distinct signatures
   * in the wild — this single typed event resolves the confusion).
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(event: 'connected', handler: Handler<NodeConnectedEvent>): Unsubscribe
  /**
   * Subscribe to slot disconnection events.
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(
    event: 'disconnected',
    handler: Handler<NodeDisconnectedEvent>
  ): Unsubscribe
  /**
   * Subscribe to canvas position changes.
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(
    event: 'positionChanged',
    handler: Handler<NodePositionChangedEvent>
  ): Unsubscribe
  /**
   * Subscribe to node size changes.
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(event: 'sizeChanged', handler: Handler<NodeSizeChangedEvent>): Unsubscribe
  /**
   * Subscribe to execution mode changes.
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
   */
  on(event: 'modeChanged', handler: Handler<NodeModeChangedEvent>): Unsubscribe
  /**
   * Subscribe to node serialization. Async-capable.
   *
   * Replaces `nodeType.prototype.onSerialize` and `nodeType.prototype.serialize`
   * patching patterns. Collapses four v1 serialization surfaces to one (D7 Part 4).
   *
   * @returns A cleanup function to remove the listener.
   * @stability experimental
   */
  on(
    event: 'beforeSerialize',
    handler: AsyncHandler<NodeBeforeSerializeEvent>
  ): Unsubscribe
}
