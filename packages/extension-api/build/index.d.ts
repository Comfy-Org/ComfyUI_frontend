import { BottomPanelExtension } from '../types/extensionTypes';
import { CommandManager } from '../types/extensionTypes';
import { createNodeExecutionId } from '../types/nodeIdentification';
import { createNodeLocatorId } from '../types/nodeIdentification';
import { defineExtension } from '../services/extension-api-service';
import { defineNode } from '../services/extension-api-service';
import { defineWidget } from '../services/extension-api-service';
import { ExtensionManager } from '../types/extensionTypes';
import { isNodeExecutionId } from '../types/nodeIdentification';
import { isNodeLocatorId } from '../types/nodeIdentification';
import { NodeExecutionId } from '../types/nodeIdentification';
import { NodeLocatorId } from '../types/nodeIdentification';
import { onNodeMounted } from '../services/extension-api-service';
import { onNodeRemoved } from '../services/extension-api-service';
import { parseNodeExecutionId } from '../types/nodeIdentification';
import { parseNodeLocatorId } from '../types/nodeIdentification';
import { SidebarTabExtension } from '../types/extensionTypes';
import { ToastManager } from '../types/extensionTypes';
import { ToastMessageOptions } from '../types/extensionTypes';

/**
 * A typed async-capable event handler. Only valid for events that explicitly
 * support async handling (currently only `beforeSerialize`).
 *
 * @typeParam E - The event payload type.
 */
export declare type AsyncHandler<E> = (event: E) => void | Promise<void>;

export { BottomPanelExtension }

export { CommandManager }

export { createNodeExecutionId }

export { createNodeLocatorId }

export { defineExtension }

export { defineNode }

export { defineWidget }

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
    name: string;
    /**
     * Runs once during app initialization (after the app is mounted but before
     * the first workflow is loaded). Equivalent to the v1 `ComfyExtension.init`.
     */
    init?(): void | Promise<void>;
    /**
     * Runs once after the app and all core extensions are initialized. Equivalent
     * to the v1 `ComfyExtension.setup`. Safe to call shell UI registration APIs
     * (`ExtensionManager`, `CommandManager`) here.
     */
    setup?(): void | Promise<void>;
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
export declare type Handler<E> = (event: E) => void;

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
    readonly context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote';
    /**
     * The mutable serialized node object. Mutate in place to append fields.
     * Type intentionally loose — the exact shape is `ISerialisedNode`.
     */
    readonly data: Record<string, unknown>;
    /**
     * Replace the serialized object by providing a transform function.
     * `fn` receives the current `data` and should return the replacement.
     * Calling this multiple times chains: each call's `fn` receives the
     * previous call's output.
     */
    replace(fn: (orig: Record<string, unknown>) => Record<string, unknown>): void;
}

/**
 * Payload for `node.on('connected', handler)`.
 *
 * Replaces `nodeType.prototype.onConnectInput` / `onConnectOutput` and
 * `nodeType.prototype.onConnectionsChange` patching.
 */
export declare interface NodeConnectedEvent {
    /** The local slot that was connected. */
    readonly slot: SlotInfo;
    /** The remote slot on the other node. */
    readonly remote: SlotInfo;
}

/**
 * Payload for `node.on('disconnected', handler)`.
 */
export declare interface NodeDisconnectedEvent {
    /** The local slot that was disconnected. */
    readonly slot: SlotInfo;
}

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
    readonly output: Record<string, unknown>;
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
    name: string;
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
    nodeTypes?: string[];
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
    nodeCreated?(node: NodeHandle): void;
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
    loadedGraphNode?(node: NodeHandle): void;
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
export declare interface NodeHandle {
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
    readonly id: string;
    /**
     * Returns `true` if `other` represents the same node entity as this one.
     * Equivalent to `this.id === other.id` but the canonical comparator —
     * prefer `equals` over manual string comparison so future changes to the
     * identity scheme remain transparent.
     */
    equals(other: NodeHandle): boolean;
    /**
     * The LiteGraph node type string (e.g. `'KSampler'`).
     * Read-only invariant: set at construction, never changes.
     *
     */
    readonly type: string;
    /**
     * The ComfyUI backend class name (e.g. `'KSampler'`).
     * Equal to `type` for most nodes; differs for reroute/virtual nodes.
     * Read-only invariant.
     *
     */
    readonly comfyClass: string;
    /**
     * Returns the node's current position as `[x, y]` in **canvas units**.
     *
     * Canvas units are the LiteGraph internal coordinate space — independent
     * of zoom, pan, or `devicePixelRatio`. To position a DOM overlay aligned
     * with the node visually on screen, use {@link defineWidget}'s
     * `mount(host, ctx)` seam (host is pre-positioned by the runtime). For
     * legitimate screen-space needs (custom hit-testing, hi-DPI math,
     * floating overlays anchored to absolute browser coordinates), the
     * documented escape-hatch is `window.app.canvas.ds.scale` /
     * `window.app.canvas.ds.offset` + `window.app.canvas.canvas
     * .getBoundingClientRect()`. The escape-hatch is `@stability escape-hatch`
     * (deliberately fragile) — see `D-coord-space.md § Documentation contract`.
     *
     * @stability stable
     */
    getPosition(): Point;
    /**
     * Moves the node to a new position. **Argument is in canvas units.**
     * Dispatches a `MoveNode` command.
     *
     * No conversion is performed — passing screen pixels here will move
     * the node by screen-pixel amounts in canvas space (almost always a
     * bug). To convert a screen-space pointer event to canvas units before
     * calling this, use the escape-hatch — see {@link getPosition} JSDoc.
     *
     * @stability stable
     */
    setPosition(pos: Point): void;
    /**
     * Returns the node's current size as `[width, height]` in **canvas units**.
     *
     * Same coordinate-space semantics as {@link getPosition}: zoom and
     * `devicePixelRatio` are NOT applied. A 200-canvas-unit-wide node will
     * appear as 100 CSS px wide at 50% zoom or 400 CSS px wide at 200% zoom.
     * For DOM-overlay sizing, prefer the {@link defineWidget} `mount` seam
     * which provides a pre-positioned host.
     *
     * @stability stable
     */
    getSize(): Size;
    /**
     * Resizes the node. **Argument is in canvas units.**
     * Dispatches a `ResizeNode` command.
     *
     * @stability stable
     */
    setSize(size: Size): void;
    /**
     * Returns the node's display title. Defaults to the node type string.
     *
     */
    getTitle(): string;
    /**
     * Sets the node's display title. Dispatches a `SetNodeVisual` command.
     *
     */
    setTitle(title: string): void;
    /**
     * Returns `true` if the node is currently selected on the canvas.
     *
     */
    isSelected(): boolean;
    /**
     * Returns the node's current execution mode.
     *
     */
    getMode(): NodeMode;
    /**
     * Sets the node's execution mode. Dispatches a `SetNodeMode` command.
     *
     */
    setMode(mode: NodeMode): void;
    /**
     * Returns a per-node-instance property by key.
     *
     * In v2, prefer routing persistent state through widget values or
     * `beforeSerialize` events. `node.properties` is kept as a migration shim
     * for v1 extensions that used it for per-instance widget config (e.g. min/max).
     *
     */
    getProperty<T = unknown>(key: string): T | undefined;
    /**
     * Returns a copy of all per-node-instance properties.
     *
     */
    getProperties(): Record<string, unknown>;
    /**
     * Sets a per-node-instance property. Dispatches a `SetNodeProperty` command.
     *
     * In v2, prefer `widget.setOption(key, value)` for widget-scoped per-instance
     * config (it persists to the `widget_options` sidecar in the workflow JSON).
     *
     */
    setProperty(key: string, value: unknown): void;
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
    getWidget(name: string): WidgetHandle | undefined;
    /**
     * Returns all widgets on this node as `WidgetHandle` instances.
     *
     * **Immutable view per D-immutability-enforcement (Hybrid C).** The returned
     * array cannot be mutated (`push`, `splice`, `length =`, index assignment
     * all raise TS errors). Each `WidgetHandle` is also surface-frozen — use
     * the `WidgetHandle` setter methods (`setValue`, `setHidden`, etc.) to
     * mutate widget state. To add or remove widgets, use
     * {@link NodeHandle.addWidget} / future `removeWidget` (W6.P8.UNMIGRATABLE).
     *
     * @example
     * ```ts
     * // ❌ TS-ERR — readonly array; v1 patterns no longer compile
     * node.getWidgets().push(newWidget)
     * node.getWidgets()[0] = newWidget
     *
     * // ✅ Iterate / read freely
     * for (const w of node.getWidgets()) console.log(w.name)
     * const labels = node.getWidgets().map((w) => w.label)
     * ```
     */
    getWidgets(): ReadonlyArray<Readonly<WidgetHandle>>;
    /**
     * Adds a new widget to this node.
     *
     * @param type - Widget type string (e.g. `'INT'`, `'STRING'`, `'COMBO'`).
     * @param name - Unique widget name on this node.
     * @param defaultValue - Initial value.
     * @param options - Optional type-specific options.
     * @returns The new `WidgetHandle`.
     */
    addWidget(type: string, name: string, defaultValue: unknown, options?: Partial<WidgetOptions>): WidgetHandle;
    /**
     * Returns all input slots on this node.
     *
     * **Immutable view per D-immutability-enforcement (Hybrid C).** The returned
     * array and each slot are `Readonly` — `node.getInputs().push(...)`,
     * `node.getInputs()[i] = X`, and `node.getInputs()[i].name = "x"` all raise
     * TypeScript errors at compile time. Per-slot mutators (`setInputName`,
     * `replaceInput`, bulk field setters) are tracked under
     * W6.P8.UNMIGRATABLE / D-input-output-shape.
     *
     * @example
     * ```ts
     * // ❌ TS-ERR — readonly array; v1 patterns no longer compile
     * node.getInputs().push({ name: 'x', type: 'INT' })
     * node.getInputs()[0].name = 'renamed'
     *
     * // ✅ Read / iterate freely
     * const types = node.getInputs().map((s) => s.type)
     * ```
     */
    getInputs(): ReadonlyArray<Readonly<SlotInfo>>;
    /**
     * Returns all output slots on this node.
     *
     * **Immutable view per D-immutability-enforcement (Hybrid C).** Same
     * read-only semantics as {@link NodeHandle.getInputs}. Per-slot mutators
     * tracked under W6.P8.UNMIGRATABLE / D-input-output-shape.
     */
    getOutputs(): ReadonlyArray<Readonly<SlotInfo>>;
    /**
     * @deprecated Use {@link NodeHandle.getInputs} instead. Renamed to align
     * with the `getX()` accessor convention (D11/D-immutability-enforcement).
     * Will be removed in v1.0.
     */
    inputs(): ReadonlyArray<Readonly<SlotInfo>>;
    /**
     * @deprecated Use {@link NodeHandle.getOutputs} instead. Renamed to align
     * with the `getX()` accessor convention (D11/D-immutability-enforcement).
     * Will be removed in v1.0.
     */
    outputs(): ReadonlyArray<Readonly<SlotInfo>>;
    /**
     * Subscribe to node removal (graph deletion, not subgraph promotion).
     *
     * Replaces the v1 `nodeType.prototype.onRemoved` patching pattern.
     * Does NOT fire on subgraph promotion — the node's entity ID is preserved
     * across promotion.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'removed', handler: Handler<void>): Unsubscribe;
    /**
     * Subscribe to backend execution completion for this node.
     *
     * Replaces the v1 `nodeType.prototype.onExecuted` patching pattern (the
     * most widely used anti-pattern per R4-P3; 5+ confirmed repos).
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'executed', handler: Handler<NodeExecutedEvent>): Unsubscribe;
    /**
     * Subscribe to workflow hydration (node loaded from a saved workflow).
     *
     * Replaces the v1 `nodeType.prototype.onConfigure` / `loadedGraphNode`
     * patterns. Fires after all widget values are restored from the workflow JSON.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'configured', handler: Handler<void>): Unsubscribe;
    /**
     * Subscribe to slot connection events.
     *
     * Replaces `nodeType.prototype.onConnectInput`, `onConnectOutput`, and
     * `onConnectionsChange` patching patterns (R4-P4: six distinct signatures
     * in the wild — this single typed event resolves the confusion).
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'connected', handler: Handler<NodeConnectedEvent>): Unsubscribe;
    /**
     * Subscribe to slot disconnection events.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'disconnected', handler: Handler<NodeDisconnectedEvent>): Unsubscribe;
    /**
     * Subscribe to canvas position changes.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'positionChanged', handler: Handler<NodePositionChangedEvent>): Unsubscribe;
    /**
     * Subscribe to node size changes.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'sizeChanged', handler: Handler<NodeSizeChangedEvent>): Unsubscribe;
    /**
     * Subscribe to execution mode changes.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'modeChanged', handler: Handler<NodeModeChangedEvent>): Unsubscribe;
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
    on(event: 'beforeSerialize', handler: AsyncHandler<NodeBeforeSerializeEvent>): Unsubscribe;
}

export { NodeLocatorId }

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
export declare type NodeMode = 'always' | 'never' | 'bypass' | 'once' | 'onTrigger';

/**
 * Payload for `node.on('modeChanged', handler)`.
 */
export declare interface NodeModeChangedEvent {
    /** The new execution mode. */
    readonly mode: NodeMode;
}

/**
 * Payload for `node.on('positionChanged', handler)`.
 */
export declare interface NodePositionChangedEvent {
    /** The new position. */
    readonly pos: Point;
}

/**
 * Payload for `node.on('sizeChanged', handler)`.
 */
export declare interface NodeSizeChangedEvent {
    /** The new size. */
    readonly size: Size;
}

export { onNodeMounted }

export { onNodeRemoved }

export { parseNodeExecutionId }

export { parseNodeLocatorId }

/**
 * A 2D point as `[x, y]`.
 *
 * **Immutable tuple per D-immutability-enforcement (Hybrid C).** Attempts to
 * mutate via `node.getPosition()[0] = X` raise a TypeScript error. Use
 * {@link NodeHandle.setPosition} to move the node.
 */
export declare type Point = readonly [x: number, y: number];

export { SidebarTabExtension }

/**
 * A 2D size as `[width, height]`.
 *
 * **Immutable tuple per D-immutability-enforcement (Hybrid C).** Attempts to
 * mutate via `node.getSize()[0] = X` raise a TypeScript error. Use
 * {@link NodeHandle.setSize} to resize the node.
 */
export declare type Size = readonly [width: number, height: number];

/**
 * Direction of a slot on a node.
 */
export declare type SlotDirection = 'input' | 'output';

/**
 * Read-only snapshot of a single slot (input or output) on a node.
 *
 * Identity is opaque per D20: use `slot.id` and `slot.equals(other)` for
 * comparisons; do not parse the string format.
 */
export declare interface SlotInfo {
    /** Opaque identifier for this slot. Treat as a string token; do not parse. */
    readonly id: string;
    /** Slot name as declared in `INPUT_TYPES` or `addInput`/`addOutput`. */
    readonly name: string;
    /** Slot type string (e.g. `'IMAGE'`, `'LATENT'`, `'*'`). */
    readonly type: string;
    /** Whether this is an input or output slot. */
    readonly direction: SlotDirection;
    /** Opaque identifier of the node this slot belongs to. */
    readonly nodeId: string;
    /**
     * Returns `true` if `other` represents the same slot entity as this one.
     * Equivalent to `this.id === other.id` but the canonical comparator.
     */
    equals(other: SlotInfo): boolean;
}

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
export declare type Unsubscribe = () => void;

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
    reject(message: string): void;
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
    readonly context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote';
    /**
     * The widget's current value at the time of serialization (before any override).
     * Equivalent to calling `widget.getValue()`.
     */
    readonly value: T;
    /**
     * Override the serialized value. The provided value is written to
     * `widgets_values[i]` (and to the API prompt for `context='prompt'`).
     * Calling this multiple times keeps the last call's value.
     *
     * @param v - The value to serialize. Must be JSON-serializable.
     */
    setSerializedValue(v: unknown): void;
    /**
     * Exclude this widget from the API prompt entirely.
     * Only meaningful for `context='prompt'`; no-ops on other contexts.
     * Replaces `widget.options.serialize = false` and `() => undefined` patterns.
     */
    skip(): void;
}

/**
 * Cleanup function returned from a widget's `mount()`. Fires exactly once,
 * when the widget entity is destroyed. **Does NOT fire on host remount**
 * (graph↔app mode, subgraph promotion, `<KeepAlive>` shuffle) — use
 * {@link WidgetMountContext.onBeforeRemount} / {@link WidgetMountContext.onAfterRemount}
 * for those.
 *
 * @stability experimental
 */
export declare type WidgetCleanup = () => void;

/**
 * Options for `defineWidget`. Registers a custom widget type that renders
 * through the mount-lifecycle seam (Axiom A12 / D-widget-converge).
 *
 * Once registered, the widget can be instantiated on any node via
 * `node.addWidget(type, name, defaultValue, opts?)`. The runtime allocates
 * a per-widget host `<div>` and invokes the registered `mount(host, ctx)`
 * hook against it. The widget's mount body captures the host (and any DOM
 * it constructs) via closure — there is no `widget.element` accessor on
 * the handle.
 *
 * `mount` is optional: omit it for value-only widgets (numeric, combo, etc.)
 * that render through the native widget renderer with no custom DOM.
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
 *   mount(host, ctx) {
 *     const input = document.createElement('input')
 *     input.type = 'color'
 *     input.value = String(ctx.widget.getValue() ?? '#000000')
 *     input.addEventListener('input', () => ctx.widget.setValue(input.value))
 *     host.appendChild(input)
 *     // Optional cleanup — fires once on widget destruction.
 *     return () => input.remove()
 *   }
 * })
 * ```
 */
export declare interface WidgetExtensionOptions {
    /** Globally unique extension name. */
    name: string;
    /** Widget type string this extension provides (e.g. `'COLOR_PICKER'`). */
    type: string;
    /**
     * Mount lifecycle hook — the **sole** DOM seam per Axiom A12. Called once
     * per widget instance when the widget is first attached to its node host
     * in the DOM. May return a `WidgetCleanup` function that fires on widget
     * destruction (host remount does NOT fire cleanup; see
     * `WidgetMountContext.onBeforeRemount` / `onAfterRemount`).
     *
     * Omit entirely for value-only widgets that need no custom DOM.
     *
     * @stability experimental
     */
    mount?: WidgetMountFn;
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
     * Opaque identifier for this widget. Stable for the lifetime of the
     * widget entity. Treat as a string token: do not parse, slice, or compare
     * its internal structure. Use {@link WidgetHandle.equals} to compare with
     * another handle.
     *
     * @remarks
     * Per D20, the underlying value is a branded `WidgetEntityId` at runtime
     * but is narrowed to `string` on the public surface so authors never need
     * to import a brand to type a local variable.
     */
    readonly id: string;
    /**
     * Returns `true` if `other` represents the same widget entity as this
     * one. Equivalent to `this.id === other.id` but the canonical comparator
     * — prefer `equals` over manual string comparison so future changes to
     * the identity scheme remain transparent.
     */
    equals(other: WidgetHandle): boolean;
    /**
     * The widget's name as registered in `INPUT_TYPES` or `addWidget`. Stable
     * for the lifetime of the node; never changes after creation.
     *
     */
    readonly name: string;
    /**
     * The widget's type string (e.g. `'INT'`, `'STRING'`, `'COMBO'`,
     * `'MARKDOWN'`). Read-only invariant set at creation.
     *
     */
    readonly widgetType: string;
    /**
     * Returns the widget's current user-edited value.
     *
     * @typeParam T - Narrows the return type when you know the widget type.
     * @example
     * ```ts
     * const steps = node.getWidget('steps')!.getValue<number>()
     * ```
     */
    getValue(): T;
    /**
     * Sets the widget's value. Dispatches a `SetWidgetValue` command (undo-able).
     * Triggers `valueChange` handlers on all views.
     *
     */
    setValue(value: T): void;
    /**
     * Returns `true` if the widget is currently hidden from the node UI.
     *
     */
    isHidden(): boolean;
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
    setHidden(hidden: boolean): void;
    /**
     * Returns `true` if the widget is disabled (read-only in the UI).
     *
     */
    isDisabled(): boolean;
    /**
     * Enable or disable the widget.
     *
     */
    setDisabled(disabled: boolean): void;
    /**
     * The widget's display label shown to the user. Defaults to the widget name.
     * Read-only invariant (set at creation, never changes after).
     *
     * To override at construction, pass `label` to `addWidget()` options.
     */
    readonly label: string;
    /**
     * Updates the reserved height for this widget and triggers a node relayout.
     *
     * Meaningful for widgets registered via {@link defineWidget} with a
     * {@link WidgetMountFn} `mount()` body — the reserved height bounds the
     * runtime-owned host `<div>` that the mount body renders into. For widgets
     * that render through the native widget renderer (no `mount`), this is a
     * no-op.
     *
     * Replaces the v1 pattern of re-assigning `node.computeSize` to return a new
     * height whenever the embedded element resizes.
     *
     * @param px - New reserved height in pixels.
     * @stability experimental
     */
    setHeight(px: number): void;
    /**
     * Returns `true` if this widget is included in workflow and prompt
     * serialization. Defaults to `true` for all widget types.
     *
     */
    isSerializeEnabled(): boolean;
    /**
     * Enable or disable serialization for this widget. When disabled, the widget
     * is excluded from both `widgets_values` in the workflow JSON and the API
     * prompt payload. Equivalent to the v1 `widget.options.serialize = false`
     * pattern.
     *
     */
    setSerializeEnabled(enabled: boolean): void;
    /**
     * Read-only snapshot of the full options bag for this widget.
     *
     * **Immutable per D-immutability-enforcement (Hybrid C).** The returned
     * object is `Readonly<WidgetOptions>` — `widget.options.min = 0`,
     * `widget.options = {...}`, and `widget.options.values = [...]` all raise
     * TypeScript errors at compile time. To mutate, use
     * {@link WidgetHandle.setOption} per-key.
     *
     * Note: this is an accessor pair on the v2 surface. Reading is free; the
     * setter intentionally does not exist on the public type. v1 patterns like
     * `widget.options.serialize = false` should migrate to
     * {@link WidgetHandle.setSerializeEnabled}; `widget.options.values = [...]`
     * (combo refresh) migrates to a future `setValues` mutator (tracked
     * under W6.P8.UNMIGRATABLE).
     *
     * @example
     * ```ts
     * // ❌ TS-ERR — every option write raises a compile-time error
     * widget.options.min = 0
     * widget.options = { min: 0, max: 100 }
     * widget.options.serialize = false
     *
     * // ✅ Read freely
     * const min = widget.options.min ?? 0
     *
     * // ✅ Mutate via typed setters
     * widget.setOption('min', 0)
     * widget.setSerializeEnabled(false)
     * ```
     */
    readonly options: Readonly<WidgetOptions>;
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
    getOption<K = unknown>(key: string): K | undefined;
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
    setOption(key: string, value: unknown): void;
    /**
     * The widget's current `serializeValue` function (or `undefined` if none is
     * registered).
     *
     * **Accessor-only per D-immutability-enforcement (Hybrid C).** The setter
     * intentionally does not exist on the public type — assignment
     * (`widget.serializeValue = fn`) raises a TypeScript error. The v2
     * migration target is the {@link WidgetHandle.on | `on('beforeSerialize', fn)`}
     * event (per D5), which is typed, async-capable, and composable across
     * multiple extensions on the same widget.
     *
     * @deprecated v1 callers reading `widget.serializeValue` to invoke the
     * function directly should subscribe to `'beforeSerialize'` instead. This
     * read-only accessor exists for debugging / introspection only and may be
     * removed once the v1 surface is fully retired.
     *
     * @example
     * ```ts
     * // ❌ TS-ERR — direct assignment no longer compiles
     * widget.serializeValue = () => 'static value'
     *
     * // ✅ Subscribe to the typed event (D5)
     * widget.on('beforeSerialize', (e) => {
     *   if (e.context === 'prompt') e.setSerializedValue('static value')
     * })
     * ```
     *
     * @stability experimental
     */
    readonly serializeValue: ((...args: unknown[]) => unknown) | undefined;
    /**
     * Subscribe to the widget's value changes.
     *
     * Replaces the v1 `widget.callback` pattern.
     * Fires synchronously after the value is committed.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'valueChange', handler: Handler<WidgetValueChangeEvent<T>>): Unsubscribe;
    /**
     * Subscribe to type-specific option mutations (`setOption(key, value)`).
     *
     * Fires for options-bag changes (e.g. `min`, `max`, `step`, `multiline`).
     * Does NOT fire for value changes or first-class field changes.
     *
     * @returns A cleanup function to remove the listener.
     * @stability experimental
     */
    on(event: 'optionChange', handler: Handler<WidgetOptionChangeEvent>): Unsubscribe;
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
    on(event: 'propertyChange', handler: Handler<WidgetPropertyChangeEvent>): Unsubscribe;
    /**
     * Subscribe to widget serialization. The only async-allowed event.
     *
     * Replaces `widget.serializeValue = fn` and the v1 `widget.options.serialize`
     * flag. The handler may be sync or async; async handlers are awaited before
     * the serialization payload is sent.
     *
     * @returns A cleanup function to remove the listener.
     */
    on(event: 'beforeSerialize', handler: AsyncHandler<WidgetBeforeSerializeEvent<T>>): Unsubscribe;
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
    on(event: 'beforeQueue', handler: Handler<WidgetBeforeQueueEvent>): Unsubscribe;
}

/**
 * Context passed to a widget's `mount()` function.
 *
 * Per **Axiom A12** (Mount-Lifecycle as the Sole DOM Seam), this is the only
 * surface through which DOM enters a widget. Authors capture the host element
 * and any constructed DOM via closure inside `mount()` — there is no
 * `widget.element` / `widget.inputEl` accessor on the handle.
 *
 * @stability experimental
 */
export declare interface WidgetMountContext {
    /** The widget being mounted. Use for `getValue` / `setValue` / `on(...)`. */
    readonly widget: WidgetHandle;
    /** The node hosting this widget. */
    readonly node: NodeHandle;
    /**
     * Register a callback that fires when the widget entity is destroyed.
     * Equivalent to returning a cleanup function from `mount()`; provided as
     * a hook for composition (e.g. inside helpers that own their own
     * sub-resources).
     */
    onUnmount(fn: () => void): void;
    /**
     * Register a callback that fires immediately **before** the widget's host
     * `<div>` is moved to a new location (graph↔app mode, subgraph promotion,
     * Vue `<KeepAlive>` shuffle). Use to detach observers, pause animations,
     * or capture scroll position before the move.
     *
     * The widget's mount body is NOT re-invoked across a remount; only
     * `onBeforeRemount` then `onAfterRemount` fire.
     */
    onBeforeRemount(fn: () => void): void;
    /**
     * Register a callback that fires immediately **after** the widget's host
     * `<div>` has been moved to a new location. Receives the new host element
     * so authors can re-attach observers, restore scroll position, etc.
     */
    onAfterRemount(fn: (newHost: HTMLElement) => void): void;
}

/**
 * Mount function for a widget. Called once when the widget is first attached
 * to a node host in the DOM. Returns an optional cleanup function that fires
 * on widget destruction.
 *
 * @param host - A runtime-owned empty `<div>` for the widget to mount into.
 *   The widget MAY append children, set inline styles, attach event listeners,
 *   etc. It MUST NOT replace or remove the host itself.
 * @param ctx - Mount context with the widget/node handles and remount hooks.
 * @returns Optional cleanup function called on widget destruction. Host
 *   remount fires `ctx.onBeforeRemount` / `ctx.onAfterRemount` instead.
 *
 * @stability experimental
 */
export declare type WidgetMountFn = (host: HTMLElement, ctx: WidgetMountContext) => void | WidgetCleanup;

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
    readonly key: string;
    /** Value before the change. */
    readonly oldValue: unknown;
    /** Value after the change. */
    readonly newValue: unknown;
}

/**
 * Options passed to `node.addWidget()` when creating a new widget.
 *
 * Type-specific keys (e.g. `min`, `max`, `step` for numeric widgets;
 * `multiline`, `dynamicPrompts` for strings) are passed through as-is.
 */
export declare interface WidgetOptions {
    /** If `true`, the widget is hidden from the node UI on creation. */
    hidden?: boolean;
    /** If `true`, the widget is rendered read-only (no user editing). */
    readonly?: boolean;
    /** If `false`, this widget is excluded from workflow/prompt serialization. */
    serialize?: boolean;
    /** Display label override. Defaults to the widget `name`. */
    label?: string;
    /** Toggle label shown when value is `true` (BOOLEAN widgets). */
    labelOn?: string;
    /** Toggle label shown when value is `false` (BOOLEAN widgets). */
    labelOff?: string;
    /** Multiline text input (STRING widgets). */
    multiline?: boolean;
    /**
     * When `true`, the widget value is processed for dynamic prompt syntax
     * at serialize time. (STRING widgets with `dynamicPrompts: true`.)
     */
    dynamicPrompts?: boolean;
    /** Min value for numeric widgets (INT, FLOAT). */
    min?: number;
    /** Max value for numeric widgets. */
    max?: number;
    /** Step size for numeric widgets. */
    step?: number;
    /** Default value at construction time. */
    default?: unknown;
    /** Any additional type-specific option. */
    [key: string]: unknown;
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
    readonly property: 'hidden' | 'disabled' | 'serialize';
    /** Value before the change. */
    readonly oldValue: boolean;
    /** Value after the change. */
    readonly newValue: boolean;
}

/**
 * The union of all legal widget scalar values. Complex widgets (DOM, canvas)
 * may return their own serializable shapes.
 */
export declare type WidgetValue = string | number | boolean | null;

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
    readonly oldValue: T;
    /** Value after the change. */
    readonly newValue: T;
}

export { }
