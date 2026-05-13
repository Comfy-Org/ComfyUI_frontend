import { AsyncHandler, Handler, Unsubscribe } from './events'
import { WidgetEntityId } from '../world/entityIds'
export type { WidgetEntityId }
/**
 * The union of all legal widget scalar values. Complex widgets (DOM, canvas)
 * may return their own serializable shapes.
 *
 * @stability stable
 */
export type WidgetValue = string | number | boolean | null
/**
 * Payload for `widget.on('valueChange', handler)`.
 *
 * Replaces the v1 `widget.callback` pattern.
 *
 * @typeParam T - The widget's value type.
 * @stability stable
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
 * The data model for "options" vs "first-class fields" is defined in D7.
 * This event covers the options-bag tier (type-specific, not every-widget).
 *
 * @stability experimental — full semantics deferred to D7
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
/**
 * Payload for `widget.on('propertyChange', handler)`.
 *
 * Fires when a first-class every-widget property is mutated — specifically
 * `hidden`, `disabled`, and `serialize` (the non-value first-class fields
 * defined in D7 Part 1). Does NOT fire for `value` changes (use `valueChange`)
 * or for options-bag mutations (use `optionChange`).
 *
 * @stability experimental — property enumeration finalised in D7
 * @example
 * ```ts
 * widget.on('propertyChange', (e) => {
 *   if (e.property === 'hidden') updateLayout(e.newValue as boolean)
 * })
 * ```
 */
export interface WidgetPropertyChangeEvent {
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
 * Payload for `widget.on('beforeSerialize', handler)`.
 *
 * This is the **only async-allowed event** in v1 (per D10c / D5 Part 3).
 * Replaces `widget.serializeValue`, `widget.options.serialize = false`, and
 * the v1 `widget.serializeValue = (workflowNode, widgetIndex) => ...` pattern.
 *
 * Call `event.setSerializedValue(v)` to override what is written to
 * `widgets_values[i]` and the API prompt. Call `event.skip()` to exclude this
 * widget from the prompt entirely. Do not call either to pass through the
 * widget's current `getValue()` unchanged.
 *
 * @typeParam T - The widget's value type.
 * @stability stable
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
export interface WidgetBeforeSerializeEvent<T = WidgetValue> {
  /**
   * Which serialization path triggered this handler.
   *
   * - `'workflow'` — user is saving the workflow to disk (full round-trip).
   * - `'prompt'` — user is queueing a run (only prompt-relevant data sent to backend).
   * - `'clone'` — a copy/paste is happening; the framework already populated the
   *   cloned entity's widget value from the source. Override only if the clone should
   *   differ from the source. (See D12 for scope copy semantics.)
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
 * @stability stable
 * @example
 * ```ts
 * import { defineNodeExtension } from '@comfyorg/extension-api'
 *
 * export default defineNodeExtension({
 *   name: 'my-extension',
 *   nodeCreated(node) {
 *     const steps = node.widget('steps')
 *     if (!steps) return
 *
 *     steps.on('valueChange', (e) => console.log('steps =', e.newValue))
 *     steps.setOption('min', 1)
 *     steps.setOption('max', 150)
 *   }
 * })
 * ```
 */
export interface WidgetHandle<T = WidgetValue> {
  /**
   * Stable entity identifier for this widget. Branded to prevent mixing with
   * `NodeEntityId` at compile time.
   *
   * @stability stable
   */
  readonly entityId: WidgetEntityId
  /**
   * The widget's name as registered in `INPUT_TYPES` or `addWidget`. Stable
   * for the lifetime of the node; never changes after creation.
   *
   * @stability stable
   */
  readonly name: string
  /**
   * The widget's type string (e.g. `'INT'`, `'STRING'`, `'COMBO'`,
   * `'MARKDOWN'`). Read-only invariant set at creation.
   *
   * @stability stable
   */
  readonly widgetType: string
  /**
   * Returns the widget's current user-edited value.
   *
   * @typeParam T - Narrows the return type when you know the widget type.
   * @stability stable
   * @example
   * ```ts
   * const steps = node.widget('steps')!.getValue<number>()
   * ```
   */
  getValue(): T
  /**
   * Sets the widget's value. Dispatches a `SetWidgetValue` command (undo-able).
   * Triggers `valueChange` handlers on all views.
   *
   * @stability stable
   */
  setValue(value: T): void
  /**
   * Returns `true` if the widget is currently hidden from the node UI.
   *
   * @stability stable
   */
  isHidden(): boolean
  /**
   * Show or hide the widget. Dispatches a `SetWidgetHidden` command.
   *
   * @stability stable
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
   * @stability stable
   */
  isDisabled(): boolean
  /**
   * Enable or disable the widget.
   *
   * @stability stable
   */
  setDisabled(disabled: boolean): void
  /**
   * The widget's display label shown to the user. Defaults to the widget name.
   * Read-only invariant per D6 Part 3 (set at creation, never changes after).
   *
   * To override at construction, pass `label` to `addWidget()` options.
   *
   * @stability stable
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
   * @stability stable
   */
  isSerializeEnabled(): boolean
  /**
   * Enable or disable serialization for this widget. When disabled, the widget
   * is excluded from both `widgets_values` in the workflow JSON and the API
   * prompt payload. Equivalent to the v1 `widget.options.serialize = false`
   * pattern.
   *
   * @stability stable
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
   * @stability stable
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
   * @stability stable
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
   * Fires synchronously after the value is committed (per D10c).
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
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
   * Subscribe to widget serialization. The only async-allowed event (D10c / D5).
   *
   * Replaces `widget.serializeValue = fn` and the v1 `widget.options.serialize`
   * flag. The handler may be sync or async; async handlers are awaited before
   * the serialization payload is sent.
   *
   * @returns A cleanup function to remove the listener.
   * @stability stable
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
 * Options passed to `node.addWidget()` when creating a new widget.
 *
 * Type-specific keys (e.g. `min`, `max`, `step` for numeric widgets;
 * `multiline`, `dynamicPrompts` for strings) are passed through as-is.
 *
 * @stability stable
 */
export interface WidgetOptions {
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
