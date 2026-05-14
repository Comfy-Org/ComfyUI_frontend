import { BottomPanelExtension } from '../types/extensionTypes'
import { CommandManager } from '../types/extensionTypes'
import { createNodeExecutionId } from '../types/nodeIdentification'
import { createNodeLocatorId } from '../types/nodeIdentification'
import { CustomExtension } from '../types/extensionTypes'
import { defineExtension } from '../services/extension-api-service'
import { defineNode } from '../services/extension-api-service'
import { defineWidget } from '../services/extension-api-service'
import { ExtensionManager } from '../types/extensionTypes'
import { isNodeExecutionId } from '../types/nodeIdentification'
import { isNodeLocatorId } from '../types/nodeIdentification'
import { NodeEntityId } from '../world/entityIds'
import { NodeExecutionId } from '../types/nodeIdentification'
import { NodeLocatorId } from '../types/nodeIdentification'
import { onNodeMounted } from '../services/extension-api-service'
import { onNodeRemoved } from '../services/extension-api-service'
import { parseNodeExecutionId } from '../types/nodeIdentification'
import { parseNodeLocatorId } from '../types/nodeIdentification'
import { SidebarTabExtension } from '../types/extensionTypes'
import { startExtensionSystem } from '../services/extension-api-service'
import { ToastManager } from '../types/extensionTypes'
import { ToastMessageOptions } from '../types/extensionTypes'
import { VueExtension } from '../types/extensionTypes'
import { WidgetEntityId } from '../world/entityIds'

/**
 * A typed async-capable event handler. Only valid for events that explicitly
 * support async handling (currently only `beforeSerialize`).
 *
 * @typeParam E - The event payload type.
 */
export declare type AsyncHandler<E> = (event: E) => void | Promise<void>

export { BottomPanelExtension }

export { CommandManager }

export { createNodeExecutionId }

export { createNodeLocatorId }

export { CustomExtension }

export { defineExtension }

export { defineNode }

export { defineWidget }

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
/**
 * Options for `NodeHandle.addDOMWidget()`.
 *
 * @stability experimental
 */
export declare interface DOMWidgetOptions {
  /** Unique widget name within this node. */
  name: string
  /** The DOM element to embed in the node widget area. */
  element: HTMLElement
  /** Reserved height in pixels. Defaults to `element.offsetHeight` at mount time. */
  height?: number
}

export { ExtensionManager }

/**
 * Options for the global `defineExtension` entry point. Covers extension-wide
 * lifecycle and shell UI contributions.
 *
 * @example
 * ```ts
 * import { defineExtension } from '@comfyorg/extension-api'
 *
 * export default defineExtension({
 *   name: 'my-org.my-extension',
 *   async setup() {
 *     // App is ready; register commands, sidebar tabs, etc.
 *   }
 * })
 * ```
 */
export declare interface ExtensionOptions {
  /**
   * Globally unique extension name. Matches the format of
   * `NodeExtensionOptions.name`.
   */
  name: string
  /**
   * Runs once during app initialization (after the app is mounted but before
   * the first workflow is loaded). Equivalent to the v1 `ComfyExtension.init`.
   */
  init?(): void | Promise<void>
  /**
   * Runs once after the app and all core extensions are initialized. Equivalent
   * to the v1 `ComfyExtension.setup`. Safe to call shell UI registration APIs
   * (`ExtensionManager`, `CommandManager`) here.
   */
  setup?(): void | Promise<void>
}

/**
 * A typed event handler function.
 *
 * @typeParam E - The event payload type.
 * @example
 * ```ts
 * const handler: Handler<WidgetValueChangeEvent<number>> = (e) => {
 *   console.log(e.oldValue, '->', e.newValue)
 * }
 * ```
 */
export declare type Handler<E> = (event: E) => void

export { isNodeExecutionId }

export { isNodeLocatorId }

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
export declare interface NodeBeforeSerializeEvent {
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
 * Payload for `node.on('connected', handler)`.
 *
 * Replaces `nodeType.prototype.onConnectInput` / `onConnectOutput` and
 * `nodeType.prototype.onConnectionsChange` patching.
 */
export declare interface NodeConnectedEvent {
  /** The local slot that was connected. */
  readonly slot: SlotInfo
  /** The remote slot on the other node. */
  readonly remote: SlotInfo
}

/**
 * Payload for `node.on('disconnected', handler)`.
 */
export declare interface NodeDisconnectedEvent {
  /** The local slot that was disconnected. */
  readonly slot: SlotInfo
}

export { NodeEntityId }

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
export declare interface NodeExecutedEvent {
  /** The backend execution output for this node. Shape varies by node type. */
  readonly output: Record<string, unknown>
}

export { NodeExecutionId }

/**
 * Options for `defineNode`. Describes an extension that reacts to
 * node lifecycle events.
 *
 * @example
 * ```ts
 * import { defineNode } from '@comfyorg/extension-api'
 *
 * export default defineNode({
 *   name: 'my-org.my-extension',
 *   nodeTypes: ['KSampler'],
 *
 *   nodeCreated(node) {
 *     node.on('executed', (e) => console.log('done', e.output))
 *   }
 * })
 * ```
 */
export declare interface NodeExtensionOptions {
  /**
   * Globally unique extension name. Used for scope registry keying, hook
   * ordering (lexicographic tie-break), and debug messages.
   *
   * Convention: `'org.extension-name'` or `'Comfy.ExtensionName'`.
   */
  name: string
  /**
   * Filter to specific `comfyClass` names. When omitted, the extension
   * receives `nodeCreated` / `loadedGraphNode` for every node type.
   *
   * Replaces the v1 `beforeRegisterNodeDef` filtering pattern.
   *
   * @example
   * ```ts
   * nodeTypes: ['KSampler', 'KSamplerAdvanced']
   * ```
   */
  nodeTypes?: string[]
  /**
   * Called once per node instance when the node is first created (typed in,
   * pasted from clipboard, duplicated, or loaded without an existing workflow).
   *
   * - Runs inside a Vue `EffectScope`. All `watch` / `computed` / `onNodeMounted`
   *   calls made here are captured and disposed automatically on node removal.
   * - Must be synchronous. Kick off async work inside the body; use
   *   `loading: ref(true)` for async-dependent state.
   * - Called only once per entity ID lifetime. Copy/paste creates a fresh entity
   *   and fires `nodeCreated` again on the new entity (reset-to-fresh).
   */
  nodeCreated?(node: NodeHandle): void
  /**
   * Called once per node instance when the node is restored from a saved
   * workflow. Widget values are already populated when this fires.
   *
   * Same rules as `nodeCreated`. Exactly one of `nodeCreated` or
   * `loadedGraphNode` fires per node entity, never both.
   *
   * Replaces the v1 `loadedGraphNode` hook and `nodeType.prototype.onConfigure`
   * patching.
   */
  loadedGraphNode?(node: NodeHandle): void
}

export declare interface NodeHandle {
  /**
   * Stable entity ID for this node. Branded to prevent mixing with
   * `WidgetEntityId` at compile time.
   *
   */
  readonly entityId: NodeEntityId
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

export { NodeLocatorId }

/**
 * LiteGraph node execution mode.
 *
 * - `'always'` — Always execute.
 * - `'never'` — Never execute (muted).
 * - `'bypass'` — Bypass (passthrough).
 * - `'once'` — Execute once.
 * - `'onTrigger'` — Execute on trigger.
 */
export declare type NodeMode =
  | 'always'
  | 'never'
  | 'bypass'
  | 'once'
  | 'onTrigger'

/**
 * Payload for `node.on('modeChanged', handler)`.
 */
export declare interface NodeModeChangedEvent {
  /** The new execution mode. */
  readonly mode: NodeMode
}

/**
 * Payload for `node.on('positionChanged', handler)`.
 */
export declare interface NodePositionChangedEvent {
  /** The new position. */
  readonly pos: Point
}

/**
 * Payload for `node.on('sizeChanged', handler)`.
 */
export declare interface NodeSizeChangedEvent {
  /** The new size. */
  readonly size: Size
}

export { onNodeMounted }

export { onNodeRemoved }

export { parseNodeExecutionId }

export { parseNodeLocatorId }

/**
 * A 2D point as `[x, y]`.
 */
export declare type Point = [x: number, y: number]

export { SidebarTabExtension }

/**
 * A 2D size as `[width, height]`.
 */
export declare type Size = [width: number, height: number]

/**
 * Direction of a slot on a node.
 */
export declare type SlotDirection = 'input' | 'output'

/**
 * Branded entity ID for slots. Prevents mixing slot IDs with node/widget IDs.
 *
 * Phase A uses synthetic content-addressed format: `slot:${nodeId}:${direction}:${index}`.
 * Phase B will migrate to opaque UUIDs when ECS adds slot entity support.
 */
export declare type SlotEntityId = string & {
  readonly __brand: 'SlotEntityId'
}

/**
 * Read-only snapshot of a single slot (input or output) on a node.
 */
export declare interface SlotInfo {
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

export { startExtensionSystem }

export { ToastManager }

export { ToastMessageOptions }

/**
 * Cleanup function returned by `on()` — call to remove the listener.
 *
 * @example
 * ```ts
 * const off = node.on('executed', handler)
 * // later:
 * off()
 * ```
 */
export declare type Unsubscribe = () => void

export { VueExtension }

/**
 * Payload for `widget.on('beforeQueue', handler)`.
 *
 * Fires when the user triggers a prompt queue (before `graphToPrompt` runs).
 * Call `event.reject(message)` to cancel the queue attempt with a user-visible
 * error. Do not call `reject` to allow the queue to proceed.
 *
 * Replaces the v1 `app.queuePrompt` monkey-patching pattern (S6.A4/S6.A5)
 * for per-widget validation (e.g. required field empty, value out of range).
 * For cross-node/graph-wide rejection, see the app-level `beforePrompt` event
 * (I-UWF.4 — not yet in the API).
 *
 * @stability experimental
 * @example
 * ```ts
 * // Reject if a required field is empty
 * widget.on('beforeQueue', (e) => {
 *   if (!widget.getValue()) {
 *     e.reject('Prompt text is required before queueing.')
 *   }
 * })
 *
 * // Reject with a dynamic message
 * widget.on('beforeQueue', (e) => {
 *   const val = widget.getValue<number>()
 *   const min = widget.getOption<number>('min') ?? 0
 *   if (val < min) {
 *     e.reject(`Value ${val} is below the minimum of ${min}.`)
 *   }
 * })
 * ```
 */
export declare interface WidgetBeforeQueueEvent {
  /**
   * Reject the queue attempt, showing `message` to the user.
   * Once any handler calls `reject`, the queue is cancelled — subsequent
   * handlers still run but their `reject` calls are no-ops.
   *
   * @param message - Human-readable reason shown in the UI toast.
   */
  reject(message: string): void
}

/**
 * Payload for `widget.on('beforeSerialize', handler)`.
 *
 * This is the **only async-allowed event** in the API.
 * Replaces `widget.serializeValue`, `widget.options.serialize = false`, and
 * the v1 `widget.serializeValue = (workflowNode, widgetIndex) => ...` pattern.
 *
 * Call `event.setSerializedValue(v)` to override what is written to
 * `widgets_values[i]` and the API prompt. Call `event.skip()` to exclude this
 * widget from the prompt entirely. Do not call either to pass through the
 * widget's current `getValue()` unchanged.
 *
 * @typeParam T - The widget's value type.
 * @example
 * ```ts
 * // Dynamic prompts: replace value at serialize time
 * widget.on('beforeSerialize', (e) => {
 *   if (e.context === 'prompt') {
 *     e.setSerializedValue(processDynamicPrompt(widget.getValue()))
 *   }
 * })
 *
 * // Preview widget: exclude from prompt
 * widget.on('beforeSerialize', (e) => {
 *   if (e.context === 'prompt') e.skip()
 * })
 *
 * // Async: webcam capture — materialize frame before prompt builds
 * widget.on('beforeSerialize', async (e) => {
 *   if (e.context === 'prompt') {
 *     const frame = await captureFrame()
 *     e.setSerializedValue(frame)
 *   }
 * })
 * ```
 */
export declare interface WidgetBeforeSerializeEvent<T = WidgetValue> {
  /**
   * Which serialization path triggered this handler.
   *
   * - `'workflow'` — user is saving the workflow to disk (full round-trip).
   * - `'prompt'` — user is queueing a run (only prompt-relevant data sent to backend).
   * - `'clone'` — a copy/paste is happening; the framework already populated the
   *   cloned entity's widget value from the source. Override only if the clone should
   *   differ from the source.
   * - `'subgraph-promote'` — the widget is being promoted to a subgraph IO slot.
   */
  readonly context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
  /**
   * The widget's current value at the time of serialization (before any override).
   * Equivalent to calling `widget.getValue()`.
   */
  readonly value: T
  /**
   * Override the serialized value. The provided value is written to
   * `widgets_values[i]` (and to the API prompt for `context='prompt'`).
   * Calling this multiple times keeps the last call's value.
   *
   * @param v - The value to serialize. Must be JSON-serializable.
   */
  setSerializedValue(v: unknown): void
  /**
   * Exclude this widget from the API prompt entirely.
   * Only meaningful for `context='prompt'`; no-ops on other contexts.
   * Replaces `widget.options.serialize = false` and `() => undefined` patterns.
   */
  skip(): void
}

export { WidgetEntityId }

/**
 * Options for `defineWidget`. Describes an extension that provides a
 * custom widget type with its own DOM rendering.
 *
 * @stability experimental
 * @example
 * ```ts
 * import { defineWidget } from '@comfyorg/extension-api'
 *
 * export default defineWidget({
 *   name: 'my-org.color-picker',
 *   type: 'COLOR_PICKER',
 *
 *   created(widget, node) {
 *     return {
 *       // mount color picker DOM
 *       render(container) {},
 *       // cleanup
 *       destroy() {}
 *     }
 *   }
 * })
 * ```
 */
export declare interface WidgetExtensionOptions {
  /** Globally unique extension name. */
  name: string
  /** Widget type string this extension provides (e.g. `'COLOR_PICKER'`). */
  type: string
  /**
   * Called once per widget instance. Return a `{ render, destroy }` pair for
   * custom DOM rendering, or `void` for non-visual widgets.
   *
   * @stability experimental
   */
  created?(
    widget: WidgetHandle,
    parentNode: NodeHandle | null
  ): {
    render(container: HTMLElement): void
    destroy?(): void
  } | void
}

/**
 * Controlled surface for widget access. Backed by ECS `WidgetValue` and
 * `WidgetIdentity` components in the World. Reads query components directly;
 * writes dispatch commands (undo-able, serializable, validatable).
 *
 * All views (node, properties panel, promoted copy) share the same backing
 * `WidgetEntityId`, so mutations from any source trigger `valueChange`.
 *
 * @typeParam T - The type of `getValue()` / `setValue()`. Defaults to `WidgetValue`.
 * @example
 * ```ts
 * import { defineNode } from '@comfyorg/extension-api'
 *
 * export default defineNode({
 *   name: 'my-extension',
 *   nodeCreated(node) {
 *     const steps = node.getWidget('steps')
 *     if (!steps) return
 *
 *     steps.on('valueChange', (e) => console.log('steps =', e.newValue))
 *     steps.setOption('min', 1)
 *     steps.setOption('max', 150)
 *   }
 * })
 * ```
 */
export declare interface WidgetHandle<T = WidgetValue> {
  /**
   * Stable entity identifier for this widget. Branded to prevent mixing with
   * `NodeEntityId` at compile time.
   *
   */
  readonly entityId: WidgetEntityId
  /**
   * The widget's name as registered in `INPUT_TYPES` or `addWidget`. Stable
   * for the lifetime of the node; never changes after creation.
   *
   */
  readonly name: string
  /**
   * The widget's type string (e.g. `'INT'`, `'STRING'`, `'COMBO'`,
   * `'MARKDOWN'`). Read-only invariant set at creation.
   *
   */
  readonly widgetType: string
  /**
   * Returns the widget's current user-edited value.
   *
   * @typeParam T - Narrows the return type when you know the widget type.
   * @example
   * ```ts
   * const steps = node.getWidget('steps')!.getValue<number>()
   * ```
   */
  getValue(): T
  /**
   * Sets the widget's value. Dispatches a `SetWidgetValue` command (undo-able).
   * Triggers `valueChange` handlers on all views.
   *
   */
  setValue(value: T): void
  /**
   * Returns `true` if the widget is currently hidden from the node UI.
   *
   */
  isHidden(): boolean
  /**
   * Show or hide the widget. Dispatches a `SetWidgetHidden` command.
   *
   * @example
   * ```ts
   * toggle.on('valueChange', (e) => {
   *   detail.setHidden(!e.newValue)
   * })
   * ```
   */
  setHidden(hidden: boolean): void
  /**
   * Returns `true` if the widget is disabled (read-only in the UI).
   *
   */
  isDisabled(): boolean
  /**
   * Enable or disable the widget.
   *
   */
  setDisabled(disabled: boolean): void
  /**
   * The widget's display label shown to the user. Defaults to the widget name.
   * Read-only invariant (set at creation, never changes after).
   *
   * To override at construction, pass `label` to `addWidget()` options.
   */
  readonly label: string
  /**
   * Updates the reserved height for this DOM widget and triggers a node relayout.
   *
   * Only meaningful for widgets registered via `NodeHandle.addDOMWidget()`.
   * For non-DOM widgets this is a no-op.
   *
   * Replaces the v1 pattern of re-assigning `node.computeSize` to return a new
   * height whenever the embedded element resizes.
   *
   * @param px - New reserved height in pixels.
   * @stability experimental
   */
  setHeight(px: number): void
  /**
   * Returns `true` if this widget is included in workflow and prompt
   * serialization. Defaults to `true` for all widget types.
   *
   */
  isSerializeEnabled(): boolean
  /**
   * Enable or disable serialization for this widget. When disabled, the widget
   * is excluded from both `widgets_values` in the workflow JSON and the API
   * prompt payload. Equivalent to the v1 `widget.options.serialize = false`
   * pattern.
   *
   */
  setSerializeEnabled(enabled: boolean): void
  /**
   * Returns the per-instance override for `key`, or the class-default value
   * from `INPUT_TYPES` if no override has been set, or `undefined` if the key
   * is unknown for this widget type.
   *
   * Type-specific option names: `min`, `max`, `step` (INT/FLOAT); `multiline`,
   * `dynamicPrompts` (STRING); `image_folder`, `upload_to` (upload widgets).
   *
   * @example
   * ```ts
   * const min = widget.getOption<number>('min') ?? 0
   * ```
   */
  getOption<K = unknown>(key: string): K | undefined
  /**
   * Set a per-instance option override. Persisted as a `widget_options` sidecar
   * in the workflow JSON (additive, backward-compatible). Does not change the
   * backend prompt schema unless the extension explicitly opts in via
   * `beforeSerialize`.
   *
   * @example
   * ```ts
   * // Primitive Int/Float per-instance config (replaces node.properties anti-pattern)
   * widget.setOption('min', 0)
   * widget.setOption('max', 100)
   * widget.setOption('step', 1)
   * ```
   */
  setOption(key: string, value: unknown): void
  /**
   * Subscribe to the widget's value changes.
   *
   * Replaces the v1 `widget.callback` pattern.
   * Fires synchronously after the value is committed.
   *
   * @returns A cleanup function to remove the listener.
   */
  on(
    event: 'valueChange',
    handler: Handler<WidgetValueChangeEvent<T>>
  ): Unsubscribe
  /**
   * Subscribe to type-specific option mutations (`setOption(key, value)`).
   *
   * Fires for options-bag changes (e.g. `min`, `max`, `step`, `multiline`).
   * Does NOT fire for value changes or first-class field changes.
   *
   * @returns A cleanup function to remove the listener.
   * @stability experimental
   */
  on(
    event: 'optionChange',
    handler: Handler<WidgetOptionChangeEvent>
  ): Unsubscribe
  /**
   * Subscribe to first-class property mutations (`setHidden`, `setDisabled`,
   * `setSerializeEnabled`).
   *
   * Does NOT fire for `setValue` (use `valueChange`) or options-bag mutations
   * (use `optionChange`).
   *
   * @returns A cleanup function to remove the listener.
   * @stability experimental
   */
  on(
    event: 'propertyChange',
    handler: Handler<WidgetPropertyChangeEvent>
  ): Unsubscribe
  /**
   * Subscribe to widget serialization. The only async-allowed event.
   *
   * Replaces `widget.serializeValue = fn` and the v1 `widget.options.serialize`
   * flag. The handler may be sync or async; async handlers are awaited before
   * the serialization payload is sent.
   *
   * @returns A cleanup function to remove the listener.
   */
  on(
    event: 'beforeSerialize',
    handler: AsyncHandler<WidgetBeforeSerializeEvent<T>>
  ): Unsubscribe
  /**
   * Subscribe to pre-queue validation. Fires before `graphToPrompt` runs.
   *
   * Call `event.reject(message)` to cancel the queue with a user-visible error.
   * Replaces the v1 `app.queuePrompt` monkey-patching pattern (S6.A4/S6.A5)
   * for per-widget validation use cases.
   *
   * Handlers are sync-only — use for validation logic only, not I/O.
   *
   * @returns A cleanup function to remove the listener.
   * @stability experimental
   */
  on(
    event: 'beforeQueue',
    handler: Handler<WidgetBeforeQueueEvent>
  ): Unsubscribe
}

/**
 * Payload for `widget.on('optionChange', handler)`.
 *
 * Fires when a type-specific option is mutated via `setOption(key, value)`.
 * The exact set of observable option keys is type-dependent (e.g. `min`,
 * `max`, `step` for numeric widgets; `multiline` for strings).
 *
 * This event covers the options-bag tier (type-specific, not every-widget).
 *
 * @stability experimental
 * @example
 * ```ts
 * widget.on('optionChange', (e) => {
 *   if (e.key === 'min') clampValue(e.newValue as number)
 * })
 * ```
 */
export declare interface WidgetOptionChangeEvent {
  /** The option key that changed (e.g. `'min'`, `'max'`, `'multiline'`). */
  readonly key: string
  /** Value before the change. */
  readonly oldValue: unknown
  /** Value after the change. */
  readonly newValue: unknown
}

/**
 * Options passed to `node.addWidget()` when creating a new widget.
 *
 * Type-specific keys (e.g. `min`, `max`, `step` for numeric widgets;
 * `multiline`, `dynamicPrompts` for strings) are passed through as-is.
 */
export declare interface WidgetOptions {
  /** If `true`, the widget is hidden from the node UI on creation. */
  hidden?: boolean
  /** If `true`, the widget is rendered read-only (no user editing). */
  readonly?: boolean
  /** If `false`, this widget is excluded from workflow/prompt serialization. */
  serialize?: boolean
  /** Display label override. Defaults to the widget `name`. */
  label?: string
  /** Toggle label shown when value is `true` (BOOLEAN widgets). */
  labelOn?: string
  /** Toggle label shown when value is `false` (BOOLEAN widgets). */
  labelOff?: string
  /** Multiline text input (STRING widgets). */
  multiline?: boolean
  /**
   * When `true`, the widget value is processed for dynamic prompt syntax
   * at serialize time. (STRING widgets with `dynamicPrompts: true`.)
   */
  dynamicPrompts?: boolean
  /** Min value for numeric widgets (INT, FLOAT). */
  min?: number
  /** Max value for numeric widgets. */
  max?: number
  /** Step size for numeric widgets. */
  step?: number
  /** Default value at construction time. */
  default?: unknown
  /** Any additional type-specific option. */
  [key: string]: unknown
}

/**
 * Payload for `widget.on('propertyChange', handler)`.
 *
 * Fires when a first-class every-widget property is mutated — specifically
 * `hidden`, `disabled`, and `serialize`. Does NOT fire for `value` changes
 * (use `valueChange`) or for options-bag mutations (use `optionChange`).
 *
 * @stability experimental
 * @example
 * ```ts
 * widget.on('propertyChange', (e) => {
 *   if (e.property === 'hidden') updateLayout(e.newValue as boolean)
 * })
 * ```
 */
export declare interface WidgetPropertyChangeEvent {
  /**
   * Which first-class property changed.
   * - `'hidden'` — visibility toggled via `setHidden()`
   * - `'disabled'` — enabled/disabled via `setDisabled()`
   * - `'serialize'` — serialization opt-in/out via `setSerializeEnabled()`
   */
  readonly property: 'hidden' | 'disabled' | 'serialize'
  /** Value before the change. */
  readonly oldValue: boolean
  /** Value after the change. */
  readonly newValue: boolean
}

/**
 * The union of all legal widget scalar values. Complex widgets (DOM, canvas)
 * may return their own serializable shapes.
 */
export declare type WidgetValue = string | number | boolean | null

/**
 * Payload for `widget.on('valueChange', handler)`.
 *
 * Replaces the v1 `widget.callback` pattern.
 *
 * @typeParam T - The widget's value type.
 * @example
 * ```ts
 * widget.on('valueChange', (e) => {
 *   console.log('changed from', e.oldValue, 'to', e.newValue)
 * })
 * ```
 */
export declare interface WidgetValueChangeEvent<T = WidgetValue> {
  /** Value before the change. */
  readonly oldValue: T
  /** Value after the change. */
  readonly newValue: T
}

export {}
