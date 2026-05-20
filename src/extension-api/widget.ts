/**
 * WidgetHandle — the controlled surface for widget access in v2 extensions.
 *
 * All state reads and writes go through this interface. Internal ECS
 * components and World references are never exposed.
 *
 * @packageDocumentation
 */

import type { AsyncHandler, Handler, Unsubscribe } from './events'
import type { NodeHandle } from './node'

import type { WidgetEntityId } from '@/world/entityIds'
/**
 * Branded entity ID for widgets. Prevents mixing widget IDs with node IDs
 * at compile time. Re-exported from the world layer so the entire codebase
 * shares a single brand. The underlying value is `string` in Phase A.
 *
 * @internal Per D20 — extension authors use `widget.id: string` and
 * `widget.equals(other)`. The branded type is reserved for internal package
 * modules and is intentionally absent from the published barrel.
 */
export type { WidgetEntityId }

/**
 * The union of all legal widget scalar values. Complex widgets (DOM, canvas)
 * may return their own serializable shapes.
 */
export type WidgetValue = string | number | boolean | null

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
export interface WidgetValueChangeEvent<T = WidgetValue> {
  /** Value before the change. */
  readonly oldValue: T
  /** Value after the change. */
  readonly newValue: T
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
export interface WidgetOptionChangeEvent {
  /** The option key that changed (e.g. `'min'`, `'max'`, `'multiline'`). */
  readonly key: string
  /** Value before the change. */
  readonly oldValue: unknown
  /** Value after the change. */
  readonly newValue: unknown
}

// PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
// `WidgetPropertyChangeEvent` is vacuous after `'serialize'` was removed from
// the property union (A16: authors cannot disable serialization). The other
// historical members ('hidden', 'disabled') were already A14-deferred.
// Restoration requires a new first-class property to surface that satisfies
// A1–A16 and an axiom amendment.
//
// export interface WidgetPropertyChangeEvent {
//   readonly property: 'serialize'
//   readonly oldValue: boolean
//   readonly newValue: boolean
// }

/**
 * Payload for `widget.on('beforeSerialize', handler)`.
 *
 * This is the **only async-allowed event** in the API and, per AXIOMS.md
 * §A16 (Unified Serialization Target), the **sole** extension-author
 * interface to serialization. Replaces every v1 serialization hook:
 * `widget.serializeValue = fn`, `widget.options.serialize = false`,
 * `nodeType.prototype.serialize`.
 *
 * The hook fires **once per serialization**. The framework writes the
 * resulting payload to every transport (workflow JSON `widgets_values[i]`,
 * API prompt, clone target, subgraph promotion). Extensions do not see and
 * cannot branch on the transport — that is a framework concern (A16).
 *
 * Call `event.setSerializedValue(v)` to override what is written. Do not
 * call it to pass through the widget's current `getValue()` unchanged.
 *
 * Per A16 there is no `skip()` and no `context` discriminator. Per A15
 * (Widget Declarativity) there is no way to exclude a widget from
 * serialization — if a widget should not contribute to the payload, it
 * should not be a widget (use a boxed widget, a non-widget UI primitive,
 * or a schema input).
 *
 * @typeParam T - The widget's value type.
 * @example
 * ```ts
 * // Dynamic prompts: replace value at serialize time
 * widget.on('beforeSerialize', (e) => {
 *   e.setSerializedValue(processDynamicPrompt(widget.getValue()))
 * })
 *
 * // Async: webcam capture — materialize frame before serialization
 * widget.on('beforeSerialize', async (e) => {
 *   const frame = await captureFrame()
 *   e.setSerializedValue(frame)
 * })
 * ```
 */
export interface WidgetBeforeSerializeEvent<T = WidgetValue> {
  // PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
  // The 4-way transport discriminator inverted the direction of knowledge
  // flow — framework owns transport, extensions own value. Workflow JSON
  // and API prompt converge to a single serialized payload; clone and
  // subgraph-promote are framework concerns. Restoration requires an
  // axiom amendment to A16.
  //
  // readonly context: 'workflow' | 'prompt' | 'clone' | 'subgraph-promote'

  /**
   * The widget's current value at the time of serialization (before any override).
   * Equivalent to calling `widget.getValue()`.
   */
  readonly value: T

  /**
   * Override the serialized value. The provided value is written to every
   * transport (workflow JSON `widgets_values[i]`, API prompt, clone target,
   * subgraph promotion). Calling this multiple times keeps the last call's
   * value.
   *
   * @param v - The value to serialize. Must be JSON-serializable.
   */
  setSerializedValue(v: unknown): void

  // PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
  // `skip()` IS a per-call disable — authors cannot disable serialization
  // (A16). If a widget should not contribute to the payload, it should not
  // be a widget (A15). Restoration requires axiom amendments to A15 + A16.
  //
  // skip(): void
}

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
export interface WidgetBeforeQueueEvent {
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
 * import { defineWidget } from '@comfyorg/extension-api'
 *
 * // Per AXIOMS.md A1 (D-no-node-widget-access, 2026-05-19), nodes cannot
 * // enumerate or reference widgets — `node.getWidget(name)` was removed.
 * // To react to a specific widget's lifecycle and value changes, register
 * // a widget type and use the `mount` context's `ctx.widget` handle:
 *
 * export default defineWidget({
 *   name: 'my-extension',
 *   type: 'INT',
 *   mount(_host, { widget }) {
 *     widget.on('valueChange', (e) => console.log(widget.name, '=', e.newValue))
 *     widget.setOption('min', 1)
 *     widget.setOption('max', 150)
 *   }
 * })
 * ```
 */
export interface WidgetHandle<T = WidgetValue> {
  // ── IDENTITY ───────────────────────────────────────────────────────────────

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
  readonly id: string

  /**
   * Returns `true` if `other` represents the same widget entity as this
   * one. Equivalent to `this.id === other.id` but the canonical comparator
   * — prefer `equals` over manual string comparison so future changes to
   * the identity scheme remain transparent.
   */
  equals(other: WidgetHandle): boolean

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

  // ── VALUE — first-class, every-widget ─────────────────────────────────────

  /**
   * Returns the widget's current user-edited value.
   *
   * @typeParam T - Narrows the return type when you know the widget type.
   * @example
   * ```ts
   * // Inside `defineWidget({mount})` — `ctx.widget` is the only legal
   * // path to a `WidgetHandle` (D-no-node-widget-access removed
   * // `node.getWidget(name)`).
   * const value = widget.getValue<number>()
   * ```
   */
  getValue(): T

  /**
   * Sets the widget's value. Dispatches a `SetWidgetValue` command (undo-able).
   * Triggers `valueChange` handlers on all views.
   *
   */
  setValue(value: T): void

  // ── VISIBILITY — first-class, every-widget ────────────────────────────────
  // PHASE_A_EXCLUDED per AXIOMS.md A14: Deferred pending serialization convergence.
  // isHidden(): boolean
  // setHidden(hidden: boolean): void

  // ── DISABLED — first-class, every-widget ─────────────────────────────────
  // PHASE_A_EXCLUDED per AXIOMS.md A14: Deferred pending serialization convergence.
  // isDisabled(): boolean
  // setDisabled(disabled: boolean): void

  // ── LABEL — first-class, every-widget ────────────────────────────────────

  /**
   * The widget's display label shown to the user. Defaults to the widget name.
   * Read-only invariant (set at creation, never changes after).
   *
   * To override at construction, pass `label` to `addWidget()` options.
   */
  readonly label: string

  // ── HEIGHT — reserved layout slot for mount-lifecycle widgets ────────────

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
  setHeight(px: number): void

  // PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
  // Authors cannot disable serialization at the widget level (A16). If a
  // widget should not contribute to the serialized payload, it should not
  // be a widget (A15) — use a boxed/composed widget (BBOX-style), a
  // non-widget UI primitive, or a schema input. The sole serialization
  // interface is `widget.on('beforeSerialize', handler)`. Restoration
  // requires axiom amendments to A15 + A16 + a validated ecosystem use
  // case that no boxed/composed pattern can serve.
  //
  // isSerializeEnabled(): boolean
  // setSerializeEnabled(enabled: boolean): void

  // ── OPTIONS BAG — type-specific overrides ─────────────────────────────────

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
   * setter intentionally does not exist on the public type. Per AXIOMS.md
   * §A16, `serialize` is no longer a writable option (and no longer a key
   * on this bag) — there is no widget-level serialization disable.
   * `widget.options.values = [...]` (combo refresh) migrates to a future
   * `setValues` mutator (tracked under W6.P8.UNMIGRATABLE).
   *
   * @example
   * ```ts
   * // ❌ TS-ERR — every option write raises a compile-time error
   * widget.options.min = 0
   * widget.options = { min: 0, max: 100 }
   *
   * // ✅ Read freely
   * const min = widget.options.min ?? 0
   *
   * // ✅ Mutate via typed setters
   * widget.setOption('min', 0)
   * ```
   */
  readonly options: Readonly<WidgetOptions>

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

  // ── SERIALIZE VALUE — read-only accessor; D5 is the write path ───────────

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
   * // ✅ Subscribe to the typed event (D5). Per A16 the hook fires once
   * // and the framework writes the resulting payload to every transport;
   * // there is no transport discriminator.
   * widget.on('beforeSerialize', (e) => {
   *   e.setSerializedValue('static value')
   * })
   * ```
   *
   * @stability experimental
   */
  readonly serializeValue: ((...args: unknown[]) => unknown) | undefined

  // ── EVENTS ────────────────────────────────────────────────────────────────

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

  // PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
  // `WidgetPropertyChangeEvent` is vacuous — the only property the event
  // ever surfaced was `'serialize'`, which is gone per A16. `setHidden` /
  // `setDisabled` were already A14-deferred. Restoration requires a new
  // first-class property to surface that satisfies A1–A16.
  //
  // on(
  //   event: 'propertyChange',
  //   handler: Handler<WidgetPropertyChangeEvent>
  // ): Unsubscribe

  /**
   * Subscribe to widget serialization. The only async-allowed event.
   *
   * Per AXIOMS.md §A16 this is the **sole** extension-author interface
   * to serialization. The hook fires once per serialization and the
   * framework writes the resulting payload to every transport (workflow
   * JSON `widgets_values`, API prompt, clone target, subgraph promotion).
   * Replaces the v1 `widget.serializeValue = fn` /
   * `widget.options.serialize` patterns.
   *
   * The handler may be sync or async; async handlers are awaited before
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

// ── MOUNT LIFECYCLE — the sole DOM seam per D-widget-converge / Axiom A12 ──

/**
 * Cleanup function returned from a widget's `mount()`. Fires exactly once,
 * when the widget entity is destroyed. **Does NOT fire on host remount**
 * (graph↔app mode, subgraph promotion, `<KeepAlive>` shuffle) — use
 * {@link WidgetMountContext.onBeforeRemount} / {@link WidgetMountContext.onAfterRemount}
 * for those.
 *
 * @stability experimental
 */
export type WidgetCleanup = () => void

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
export interface WidgetMountContext {
  /** The widget being mounted. Use for `getValue` / `setValue` / `on(...)`. */
  readonly widget: WidgetHandle
  /** The node hosting this widget. */
  readonly node: NodeHandle

  /**
   * Register a callback that fires when the widget entity is destroyed.
   * Equivalent to returning a cleanup function from `mount()`; provided as
   * a hook for composition (e.g. inside helpers that own their own
   * sub-resources).
   */
  onUnmount(fn: () => void): void

  /**
   * Register a callback that fires immediately **before** the widget's host
   * `<div>` is moved to a new location (graph↔app mode, subgraph promotion,
   * Vue `<KeepAlive>` shuffle). Use to detach observers, pause animations,
   * or capture scroll position before the move.
   *
   * The widget's mount body is NOT re-invoked across a remount; only
   * `onBeforeRemount` then `onAfterRemount` fire.
   */
  onBeforeRemount(fn: () => void): void

  /**
   * Register a callback that fires immediately **after** the widget's host
   * `<div>` has been moved to a new location. Receives the new host element
   * so authors can re-attach observers, restore scroll position, etc.
   */
  onAfterRemount(fn: (newHost: HTMLElement) => void): void
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
export type WidgetMountFn = (
  host: HTMLElement,
  ctx: WidgetMountContext
) => void | WidgetCleanup

/**
 * Options passed to `node.addWidget()` when creating a new widget.
 *
 * Type-specific keys (e.g. `min`, `max`, `step` for numeric widgets;
 * `multiline`, `dynamicPrompts` for strings) are passed through as-is.
 */
export interface WidgetOptions {
  /** If `true`, the widget is hidden from the node UI on creation. */
  hidden?: boolean
  /** If `true`, the widget is rendered read-only (no user editing). */
  readonly?: boolean
  // PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
  // `serialize` contradicted A16 even as a read-only key — there is no
  // widget-level serialization disable. Already write-blocked by
  // D-immutability-enforcement; now removed from the type entirely.
  //
  // serialize?: boolean
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
