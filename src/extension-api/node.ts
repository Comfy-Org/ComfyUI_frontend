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
 *
 * **Immutable tuple per D-immutability-enforcement (Hybrid C).** Attempts to
 * mutate via `node.getPosition()[0] = X` raise a TypeScript error. Use
 * {@link NodeHandle.setPosition} to move the node.
 */
export type Point = readonly [x: number, y: number]

/**
 * A 2D size as `[width, height]`.
 *
 * **Immutable tuple per D-immutability-enforcement (Hybrid C).** Attempts to
 * mutate via `node.getSize()[0] = X` raise a TypeScript error. Use
 * {@link NodeHandle.setSize} to resize the node.
 */
export type Size = readonly [width: number, height: number]

// PHASE_A_EXCLUDED per AXIOMS.md A14: nodeMode has "egregious" use patterns.
// export type NodeMode = 'always' | 'never' | 'bypass' | 'once' | 'onTrigger'

// PHASE_A_EXCLUDED per AXIOMS.md A14: Slot/connection hooks deferred.
// export type SlotDirection = 'input' | 'output'
// export interface SlotInfo { ... }
// export type SlotEntityId = string & { readonly __brand: 'SlotEntityId' }

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

// PHASE_A_EXCLUDED per AXIOMS.md A14: Slot/connection hooks deferred.
// export interface NodeConnectedEvent { slot: SlotInfo; remote: SlotInfo }
// export interface NodeDisconnectedEvent { slot: SlotInfo }

// PHASE_A_EXCLUDED per AXIOMS.md A14: Spatial events deferred.
// export interface NodePositionChangedEvent { pos: Point }
// export interface NodeSizeChangedEvent { size: Size }

// PHASE_A_EXCLUDED per AXIOMS.md A14: nodeMode has "egregious" use patterns.
// export interface NodeModeChangedEvent { mode: NodeMode }

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
  // PHASE_A_EXCLUDED per AXIOMS.md A14: Deferred pending A13 coord-space stabilization.
  // getPosition(): Point
  // setPosition(pos: Point): void
  // getSize(): Size
  // setSize(size: Size): void

  // ── VISUAL STATE ──────────────────────────────────────────────────────────
  // PHASE_A_EXCLUDED per AXIOMS.md A14: Uncertain use case.
  // getTitle(): string
  // setTitle(title: string): void
  // isSelected(): boolean

  // ── EXECUTION MODE ────────────────────────────────────────────────────────
  // PHASE_A_EXCLUDED per AXIOMS.md A14: nodeMode has "egregious" use patterns.
  // getMode(): NodeMode
  // setMode(mode: NodeMode): void

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

  // COMMENTED OUT per AXIOMS.md A1 + A2 (D-no-node-widget-access, 2026-05-19):
  // Nodes cannot reference or enumerate their widgets. Bilateral (node→widget)
  // direction is closed; the widget→node direction (`widget.parentNode`)
  // remains the sole channel. Extensions needing per-widget coordination
  // register via `defineWidget({mount, ...})` and share state through Vue
  // `provide()` / `inject()` or the World event bus. Restoration criteria
  // in AXIOMS.md §A14.
  //
  // /**
  //  * Returns a `WidgetHandle` for the named widget, or `undefined` if no such
  //  * widget exists on this node.
  //  *
  //  * @example
  //  * ```ts
  //  * const steps = node.getWidget('steps')
  //  * if (steps) steps.setValue(20)
  //  * ```
  //  */
  // getWidget(name: string): WidgetHandle | undefined
  //
  // /**
  //  * Returns all widgets on this node as `WidgetHandle` instances.
  //  *
  //  * **Immutable view per D-immutability-enforcement (Hybrid C).** The returned
  //  * array cannot be mutated (`push`, `splice`, `length =`, index assignment
  //  * all raise TS errors). Each `WidgetHandle` is also surface-frozen — use
  //  * the `WidgetHandle` setter methods (`setValue`, `setHidden`, etc.) to
  //  * mutate widget state.
  //  *
  //  * @example
  //  * ```ts
  //  * // ❌ TS-ERR — readonly array; v1 patterns no longer compile
  //  * node.getWidgets().push(newWidget)
  //  * node.getWidgets()[0] = newWidget
  //  *
  //  * // ✅ Iterate / read freely
  //  * for (const w of node.getWidgets()) console.log(w.name)
  //  * const labels = node.getWidgets().map((w) => w.label)
  //  * ```
  //  */
  // getWidgets(): ReadonlyArray<Readonly<WidgetHandle>>

  // REMOVED per AXIOMS.md A14: Widgets are defined in Python node schema,
  // not created at frontend runtime. Node->widget mutation violates A1.
  // addWidget(type, name, defaultValue, options?): WidgetHandle

  // NOTE: `addDOMWidget(opts)` was removed per D-widget-converge / Axiom A12.
  // Custom DOM widgets are now registered via `defineWidget({type, mount})`
  // and instantiated through the same `addWidget(type, name, …)` call as
  // every other widget. The runtime invokes the registered `mount(host, ctx)`
  // hook against a per-widget host `<div>` it owns. See `WidgetMountFn` and
  // `WidgetMountContext` in `./widget` for the lifecycle contract.

  // ── SLOTS ─────────────────────────────────────────────────────────────────

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
  getInputs(): ReadonlyArray<Readonly<SlotInfo>>

  /**
   * Returns all output slots on this node.
   *
   * **Immutable view per D-immutability-enforcement (Hybrid C).** Same
   * read-only semantics as {@link NodeHandle.getInputs}. Per-slot mutators
   * tracked under W6.P8.UNMIGRATABLE / D-input-output-shape.
   */
  getOutputs(): ReadonlyArray<Readonly<SlotInfo>>

  /**
   * @deprecated Use {@link NodeHandle.getInputs} instead. Renamed to align
   * with the `getX()` accessor convention (D11/D-immutability-enforcement).
   * Will be removed in v1.0.
   */
  inputs(): ReadonlyArray<Readonly<SlotInfo>>

  /**
   * @deprecated Use {@link NodeHandle.getOutputs} instead. Renamed to align
   * with the `getX()` accessor convention (D11/D-immutability-enforcement).
   * Will be removed in v1.0.
   */
  outputs(): ReadonlyArray<Readonly<SlotInfo>>

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

  // PHASE_A_EXCLUDED per AXIOMS.md A14: Slot/connection hooks deferred.
  // on(event: 'connected', handler: Handler<NodeConnectedEvent>): Unsubscribe
  // on(event: 'disconnected', handler: Handler<NodeDisconnectedEvent>): Unsubscribe

  // PHASE_A_EXCLUDED per AXIOMS.md A14: Spatial events deferred pending A13.
  // on(event: 'positionChanged', handler: Handler<NodePositionChangedEvent>): Unsubscribe
  // on(event: 'sizeChanged', handler: Handler<NodeSizeChangedEvent>): Unsubscribe

  // PHASE_A_EXCLUDED per AXIOMS.md A14: nodeMode has "egregious" use patterns.
  // on(event: 'modeChanged', handler: Handler<NodeModeChangedEvent>): Unsubscribe

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
