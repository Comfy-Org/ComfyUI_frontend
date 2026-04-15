/**
 * Extension V2 API — public types for the new extension system.
 *
 * This is the stable public contract. Extensions depend on these types.
 * Internal implementation (ECS World, commands, scopes) is hidden.
 *
 * @packageDocumentation
 */

// ─── Branded Entity IDs ──────────────────────────────────────────────
// Compile-time distinct. Prevents passing a WidgetEntityId where a
// NodeEntityId is expected. The underlying value is always `number`.

export type NodeEntityId = number & { readonly __brand: 'NodeEntityId' }
export type WidgetEntityId = number & { readonly __brand: 'WidgetEntityId' }
export type SlotEntityId = number & { readonly __brand: 'SlotEntityId' }
export type LinkEntityId = number & { readonly __brand: 'LinkEntityId' }

// ─── Geometry ────────────────────────────────────────────────────────

export type Point = [x: number, y: number]
export type Size = [width: number, height: number]

// ─── Enums ───────────────────────────────────────────────────────────

export type NodeMode = 0 | 1 | 2 | 3 | 4

export type SlotDirection = 'input' | 'output'

// ─── Slot Info ───────────────────────────────────────────────────────

export interface SlotInfo {
  readonly entityId: SlotEntityId
  readonly name: string
  readonly type: string
  readonly direction: SlotDirection
  readonly nodeEntityId: NodeEntityId
}

// ─── Widget Options ──────────────────────────────────────────────────

export interface WidgetOptions {
  readonly?: boolean
  multiline?: boolean
  hidden?: boolean
  serialize?: boolean
  labelOn?: string
  labelOff?: string
  default?: unknown
  [key: string]: unknown
}

// ─── WidgetHandle ────────────────────────────────────────────────────
// Controlled surface for widget access. Backed by WidgetValue component
// in the ECS World. getValue/setValue dispatch commands internally.
// All views (node, properties panel, promoted copy) share the same
// backing WidgetEntityId, so changes from any source fire 'change'.

export interface WidgetHandle {
  readonly entityId: WidgetEntityId
  readonly name: string
  readonly widgetType: string

  getValue<T = unknown>(): T
  setValue(value: unknown): void

  isHidden(): boolean
  setHidden(hidden: boolean): void
  getOptions(): WidgetOptions
  setOption(key: string, value: unknown): void
  setLabel(label: string): void

  on(event: 'change', fn: (value: unknown, oldValue: unknown) => void): void
  on(event: 'removed', fn: () => void): void

  setSerializeValue(
    fn: (workflowNode: unknown, widgetIndex: number) => unknown
  ): void
}

// ─── NodeHandle ──────────────────────────────────────────────────────
// Controlled surface for node access. Backed by ECS components.
// Getters query the World. Setters dispatch commands (undo-able,
// serializable, validatable). Events are World component subscriptions
// dispatched through Vue reactivity internally.

export interface NodeHandle {
  readonly entityId: NodeEntityId
  readonly type: string
  readonly comfyClass: string

  getPosition(): Point
  getSize(): Size
  getTitle(): string
  getMode(): NodeMode
  getProperty<T = unknown>(key: string): T | undefined
  getProperties(): Record<string, unknown>
  isSelected(): boolean

  setPosition(pos: Point): void
  setSize(size: Size): void
  setTitle(title: string): void
  setMode(mode: NodeMode): void
  setProperty(key: string, value: unknown): void

  widget(name: string): WidgetHandle | undefined
  widgets(): readonly WidgetHandle[]
  addWidget(
    type: string,
    name: string,
    defaultValue: unknown,
    options?: Partial<WidgetOptions>
  ): WidgetHandle

  inputs(): readonly SlotInfo[]
  outputs(): readonly SlotInfo[]

  on(event: 'removed', fn: () => void): void
  on(event: 'executed', fn: (output: Record<string, unknown>) => void): void
  on(event: 'configured', fn: () => void): void
  on(
    event: 'connected',
    fn: (slot: SlotInfo, remote: SlotInfo) => void
  ): void
  on(event: 'disconnected', fn: (slot: SlotInfo) => void): void
  on(event: 'positionChanged', fn: (pos: Point) => void): void
  on(event: 'sizeChanged', fn: (size: Size) => void): void
  on(event: 'modeChanged', fn: (mode: NodeMode) => void): void
}

// ─── Extension Registration ─────────────────────────────────────────

export interface NodeExtensionOptions {
  /** Unique extension name */
  name: string
  /** Filter to specific comfyClass names. Omit = runs for all nodes. */
  nodeTypes?: string[]

  /** Runs once per node instance. Everything declared here is scoped to the node's lifetime. */
  nodeCreated?(node: NodeHandle): void
  /** Runs for nodes loaded from a saved workflow. */
  loadedGraphNode?(node: NodeHandle): void
}

export interface WidgetExtensionOptions {
  /** Unique extension name */
  name: string
  /** Widget type string this extension provides (e.g., 'COLOR_PICKER') */
  type: string

  /** Runs once per widget instance. Return a render/destroy pair for custom DOM. */
  widgetCreated?(
    widget: WidgetHandle,
    parentNode: NodeHandle | null
  ):
    | {
        render(container: HTMLElement): void
        destroy?(): void
      }
    | void
}

// Re-export ComfyExtension-compatible options for global lifecycle.
// Commands, keybindings, settings, etc. are unchanged from v1.
export interface ExtensionOptions {
  name: string
  init?(): void | Promise<void>
  setup?(): void | Promise<void>
}
