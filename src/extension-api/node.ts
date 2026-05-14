/**
 * NodeHandle — the controlled surface for node access in v2 extensions.
 *
 * Reads query ECS World components directly. Writes dispatch commands
 * (undo-able, serializable, validatable). Events are backed by Vue
 * reactivity watching World component changes.
 *
 * @packageDocumentation
 */

import type { AsyncHandler, Handler, Unsubscribe } from './events'
import type { WidgetHandle, WidgetOptions } from './widget'

import type { NodeEntityId } from '@/world/entityIds'
/**
 * Branded entity ID for nodes. Prevents mixing node IDs with widget IDs
 * at compile time. Re-exported from the world layer so the entire codebase
 * shares a single brand. The underlying value is `string` in Phase A
 * (e.g. `node:<graphUuid>:<localId>`).
 *
 * @internal Per D20 — extension authors use `node.id: string` and
 * `node.equals(other)`. The branded type is reserved for internal package
 * modules and is intentionally absent from the published barrel.
 */
export type { NodeEntityId }

/**
 * A 2D point as `[x, y]`.
 */
export type Point = [x: number, y: number]

/**
 * A 2D size as `[width, height]`.
 */
export type Size = [width: number, height: number]

/**
 * LiteGraph node execution mode.
 *
 * String values map to the underlying `LGraphEventMode` numeric enum
 * (`ALWAYS=0`, `ON_EVENT=1`, `NEVER=2`, `ON_TRIGGER=3`, `BYPASS=4`).
 *
 * - `'always'` — Execute every run (default).
 * - `'never'` — Muted; node is skipped during execution.
 * - `'bypass'` — Passthrough; inputs forwarded to outputs without running.
 * - `'once'` — Execute once then mute.
 * - `'onTrigger'` — Legacy ABI-reserved slot for the dead trigger/action
 *   subsystem; gated behind `LiteGraph.do_add_triggers_slots` (always
 *   `false`). Has no behavioural effect in the current scheduler. Reserved
 *   for compatibility — **do not use in new extensions**. Flagged for removal
 *   by AUDIT-LG.4 / AUDIT-LG.5.
 *
 * Cross-ref: research/architecture/audit-litegraph-pruning.md
 * §AUDIT-LG.4 §AUDIT-LG.5
 */
export type NodeMode = 'always' | 'never' | 'bypass' | 'once' | 'onTrigger'

/**
 * Direction of a slot on a node.
 */
export type SlotDirection = 'input' | 'output'

/**
 * Read-only snapshot of a single slot (input or output) on a node.
 *
 * Identity is opaque per D20: use `slot.id` and `slot.equals(other)` for
 * comparisons; do not parse the string format.
 */
export interface SlotInfo {
  /** Opaque identifier for this slot. Treat as a string token; do not parse. */
  readonly id: string
  /** Slot name as declared in `INPUT_TYPES` or `addInput`/`addOutput`. */
  readonly name: string
  /** Slot type string (e.g. `'IMAGE'`, `'LATENT'`, `'*'`). */
  readonly type: string
  /** Whether this is an input or output slot. */
  readonly direction: SlotDirection
  /** Opaque identifier of the node this slot belongs to. */
  readonly nodeId: string
  /**
   * Returns `true` if `other` represents the same slot entity as this one.
   * Equivalent to `this.id === other.id` but the canonical comparator.
   */
  equals(other: SlotInfo): boolean
}

/**
 * Branded entity ID for slots. Prevents mixing slot IDs with node/widget IDs.
 *
 * Phase A uses synthetic content-addressed format: `slot:${nodeId}:${direction}:${index}`.
 * Phase B will migrate to opaque UUIDs when ECS adds slot entity support.
 *
 * @internal Per D20 — extension authors use `slot.id: string` and
 * `slot.equals(other)`. The branded type is intentionally absent from the
 * published barrel.
 */
export type SlotEntityId = string & { readonly __brand: 'SlotEntityId' }

/**
 * Payload for `node.on('executed', handler)`.
 *
 * Replaces the v1 `nodeType.prototype.onExecuted` patching pattern.
 *
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
 */
export interface NodeConnectedEvent {
  /** The local slot that was connected. */
  readonly slot: SlotInfo
  /** The remote slot on the other node. */
  readonly remote: SlotInfo
}

/**
 * Payload for `node.on('disconnected', handler)`.
 */
export interface NodeDisconnectedEvent {
  /** The local slot that was disconnected. */
  readonly slot: SlotInfo
}

/**
 * Payload for `node.on('positionChanged', handler)`.
 */
export interface NodePositionChangedEvent {
  /** The new position. */
  readonly pos: Point
}

/**
 * Payload for `node.on('sizeChanged', handler)`.
 */
export interface NodeSizeChangedEvent {
  /** The new size. */
  readonly size: Size
}

/**
 * Payload for `node.on('modeChanged', handler)`.
 */
export interface NodeModeChangedEvent {
  /** The new execution mode. */
  readonly mode: NodeMode
}

/**
 * Payload for `node.on('beforeSerialize', handler)`.
 *
 * @deprecated Node-level serialization control will be removed in v1.0.
 * Use widget-level `widget.on('beforeSerialize')` instead. Store extension
 * state in widgets rather than arbitrary node fields.
 *
 * **Why widget-level is better:**
 * - Widget values are visible at predictable locations in workflow JSON
 * - Cleaner separation between framework and extension concerns
 * - Widget serialization hooks support async operations
 *
 * See ADR-0010 for full migration guidance.
 *
 * @stability experimental
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
 * @example
 * ```ts
 * import { defineNode } from '@comfyorg/extension-api'
 *
 * export default defineNode({
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
  // ── IDENTITY ──────────────────────────────────────────────────────────────

  /**
   * Opaque identifier for this node. Stable for the lifetime of the node
   * entity. Treat as a string token: do not parse, slice, or compare its
   * internal structure. Use {@link NodeHandle.equals} to compare with
   * another handle.
   *
   * @remarks
   * Per D20, the underlying value is a branded `NodeEntityId` at runtime
   * but is narrowed to `string` on the public surface so authors never
   * need to import a brand to type a local variable.
   */
  readonly id: string

  /**
   * Returns `true` if `other` represents the same node entity as this one.
   * Equivalent to `this.id === other.id` but the canonical comparator —
   * prefer `equals` over manual string comparison so future changes to the
   * identity scheme remain transparent.
   */
  equals(other: NodeHandle): boolean

  /**
   * The LiteGraph node type string (e.g. `'KSampler'`).
   * Read-only invariant: set at construction, never changes.
   *
   */
  readonly type: string

  /**
   * The ComfyUI backend class name (e.g. `'KSampler'`).
   * Equal to `type` for most nodes; differs for reroute/virtual nodes.
   * Read-only invariant.
   *
   */
  readonly comfyClass: string

  // ── SPATIAL STATE ─────────────────────────────────────────────────────────

  /**
   * Returns the node's current canvas position as `[x, y]`.
   *
   */
  getPosition(): Point

  /**
   * Moves the node to a new canvas position. Dispatches a `MoveNode` command.
   *
   */
  setPosition(pos: Point): void

  /**
   * Returns the node's current size as `[width, height]`.
   *
   */
  getSize(): Size

  /**
   * Resizes the node. Dispatches a `ResizeNode` command.
   *
   */
  setSize(size: Size): void

  // ── VISUAL STATE ──────────────────────────────────────────────────────────

  /**
   * Returns the node's display title. Defaults to the node type string.
   *
   */
  getTitle(): string

  /**
   * Sets the node's display title. Dispatches a `SetNodeVisual` command.
   *
   */
  setTitle(title: string): void

  /**
   * Returns `true` if the node is currently selected on the canvas.
   *
   */
  isSelected(): boolean

  // ── EXECUTION MODE ────────────────────────────────────────────────────────

  /**
   * Returns the node's current execution mode.
   *
   */
  getMode(): NodeMode

  /**
   * Sets the node's execution mode. Dispatches a `SetNodeMode` command.
   *
   */
  setMode(mode: NodeMode): void

  // ── PROPERTIES (migration shim) ───────────────────────────────────────────

  /**
   * Returns a per-node-instance property by key.
   *
   * In v2, prefer routing persistent state through widget values or
   * `beforeSerialize` events. `node.properties` is kept as a migration shim
   * for v1 extensions that used it for per-instance widget config (e.g. min/max).
   *
   */
  getProperty<T = unknown>(key: string): T | undefined

  /**
   * Returns a copy of all per-node-instance properties.
   *
   */
  getProperties(): Record<string, unknown>

  /**
   * Sets a per-node-instance property. Dispatches a `SetNodeProperty` command.
   *
   * In v2, prefer `widget.setOption(key, value)` for widget-scoped per-instance
   * config (it persists to the `widget_options` sidecar in the workflow JSON).
   *
   */
  setProperty(key: string, value: unknown): void

  // ── WIDGETS ───────────────────────────────────────────────────────────────

  /**
   * Returns a `WidgetHandle` for the named widget, or `undefined` if no such
   * widget exists on this node.
   *
   * @example
   * ```ts
   * const steps = node.getWidget('steps')
   * if (steps) steps.setValue(20)
   * ```
   */
  getWidget(name: string): WidgetHandle | undefined

  /**
   * Returns all widgets on this node as `WidgetHandle` instances.
   *
   */
  getWidgets(): readonly WidgetHandle[]

  /**
   * Adds a new widget to this node.
   *
   * @param type - Widget type string (e.g. `'INT'`, `'STRING'`, `'COMBO'`).
   * @param name - Unique widget name on this node.
   * @param defaultValue - Initial value.
   * @param options - Optional type-specific options.
   * @returns The new `WidgetHandle`.
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
   * - Includes the widget in `NodeHandle.getWidgets()`.
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

  // ── SLOTS ─────────────────────────────────────────────────────────────────

  /**
   * Returns all input slots on this node.
   *
   */
  inputs(): readonly SlotInfo[]

  /**
   * Returns all output slots on this node.
   *
   */
  outputs(): readonly SlotInfo[]

  // ── EVENTS ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to node removal (graph deletion, not subgraph promotion).
   *
   * Replaces the v1 `nodeType.prototype.onRemoved` patching pattern.
   * Does NOT fire on subgraph promotion — the node's entity ID is preserved
   * across promotion.
   *
   * @returns A cleanup function to remove the listener.
   */
  on(event: 'removed', handler: Handler<void>): Unsubscribe

  /**
   * Subscribe to backend execution completion for this node.
   *
   * Replaces the v1 `nodeType.prototype.onExecuted` patching pattern (the
   * most widely used anti-pattern per R4-P3; 5+ confirmed repos).
   *
   * @returns A cleanup function to remove the listener.
   */
  on(event: 'executed', handler: Handler<NodeExecutedEvent>): Unsubscribe

  /**
   * Subscribe to workflow hydration (node loaded from a saved workflow).
   *
   * Replaces the v1 `nodeType.prototype.onConfigure` / `loadedGraphNode`
   * patterns. Fires after all widget values are restored from the workflow JSON.
   *
   * @returns A cleanup function to remove the listener.
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
   */
  on(event: 'connected', handler: Handler<NodeConnectedEvent>): Unsubscribe

  /**
   * Subscribe to slot disconnection events.
   *
   * @returns A cleanup function to remove the listener.
   */
  on(
    event: 'disconnected',
    handler: Handler<NodeDisconnectedEvent>
  ): Unsubscribe

  /**
   * Subscribe to canvas position changes.
   *
   * @returns A cleanup function to remove the listener.
   */
  on(
    event: 'positionChanged',
    handler: Handler<NodePositionChangedEvent>
  ): Unsubscribe

  /**
   * Subscribe to node size changes.
   *
   * @returns A cleanup function to remove the listener.
   */
  on(event: 'sizeChanged', handler: Handler<NodeSizeChangedEvent>): Unsubscribe

  /**
   * Subscribe to execution mode changes.
   *
   * @returns A cleanup function to remove the listener.
   */
  on(event: 'modeChanged', handler: Handler<NodeModeChangedEvent>): Unsubscribe

  /**
   * Subscribe to node serialization. Async-capable.
   *
   * @deprecated Node-level serialization control will be removed in v1.0.
   * Use widget-level `widget.on('beforeSerialize')` instead — store extension
   * state in widgets rather than arbitrary node fields. See ADR-0010.
   *
   * **Migration example:**
   * ```ts
   * // BEFORE (deprecated)
   * node.on('beforeSerialize', (e) => {
   *   e.data['my_extension_state'] = computeState()
   * })
   *
   * // AFTER (recommended)
   * const stateWidget = node.addWidget('STRING', '_my_state', '', { hidden: true })
   * stateWidget.on('beforeSerialize', (e) => {
   *   e.setSerializedValue(JSON.stringify(computeState()))
   * })
   * ```
   *
   * @returns A cleanup function to remove the listener.
   * @stability experimental
   */
  on(
    event: 'beforeSerialize',
    handler: AsyncHandler<NodeBeforeSerializeEvent>
  ): Unsubscribe
}
