/**
 * Extension V2 Service — wires the new extension API to the existing system.
 *
 * This is the bridge layer. It:
 * 1. Registers v2 extensions alongside v1 extensions
 * 2. Creates NodeHandle/WidgetHandle wrappers around LGraphNode/BaseWidget
 * 3. Manages EffectScopes per extension+entity for automatic cleanup
 * 4. Dispatches nodeCreated/loadedGraphNode hooks to v2 extensions
 *
 * The LGraphNode bridge will be replaced by direct ECS World access once
 * ADR 0008 is implemented. The NodeHandle interface stays the same.
 */

import { EffectScope, onScopeDispose } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  NodeEntityId,
  NodeExtensionOptions,
  NodeHandle,
  Point,
  Size,
  SlotInfo,
  WidgetEntityId,
  WidgetExtensionOptions,
  WidgetHandle,
  WidgetOptions
} from '@/types/extensionV2'

// ─── Scope Registry ──────────────────────────────────────────────────
// One EffectScope per extension+node pair. When the node is removed,
// scope.stop() auto-cleans all watchers, listeners, and derived state.

const scopeRegistry = new Map<string, EffectScope>()

function scopeKey(extensionName: string, entityId: number): string {
  return `${extensionName}:${entityId}`
}

function getOrCreateScope(extensionName: string, entityId: number): EffectScope {
  const key = scopeKey(extensionName, entityId)
  let scope = scopeRegistry.get(key)
  if (!scope) {
    scope = new EffectScope(true)
    scopeRegistry.set(key, scope)
  }
  return scope
}

function disposeScope(extensionName: string, entityId: number): void {
  const key = scopeKey(extensionName, entityId)
  const scope = scopeRegistry.get(key)
  if (scope) {
    scope.stop()
    scopeRegistry.delete(key)
  }
}

// ─── Bridge: LGraphNode → NodeHandle ─────────────────────────────────
// Wraps the legacy class in the stable public interface.
// Once ECS World exists, this reads from World components instead.

let nextEntityId = 1
const nodeEntityMap = new WeakMap<LGraphNode, NodeEntityId>()

function getNodeEntityId(node: LGraphNode): NodeEntityId {
  let id = nodeEntityMap.get(node)
  if (id === undefined) {
    id = nextEntityId++ as NodeEntityId
    nodeEntityMap.set(node, id)
  }
  return id
}

function createWidgetHandle(
  widget: IBaseWidget,
  _extensionName: string
): WidgetHandle {
  const entityId = nextEntityId++ as WidgetEntityId

  const listeners: Record<string, Set<Function>> = {}

  const handle: WidgetHandle = {
    entityId,
    name: widget.name,
    widgetType: String(widget.type),

    getValue<T = unknown>(): T {
      return widget.value as T
    },
    setValue(value: unknown) {
      const old = widget.value
      widget.value = value as typeof widget.value
      listeners['change']?.forEach((fn) => fn(value, old))
    },

    isHidden() {
      return widget.hidden ?? false
    },
    setHidden(hidden: boolean) {
      widget.hidden = hidden
      if (widget.options) widget.options.hidden = hidden
    },

    getOptions(): WidgetOptions {
      return { ...widget.options } as WidgetOptions
    },
    setOption(key: string, value: unknown) {
      if (widget.options) {
        ;(widget.options as Record<string, unknown>)[key] = value
      }
    },
    setLabel(label: string) {
      widget.label = label
    },

    on(event: string, fn: Function) {
      if (!listeners[event]) listeners[event] = new Set()
      listeners[event].add(fn)
    },

    setSerializeValue(
      fn: (workflowNode: unknown, widgetIndex: number) => unknown
    ) {
      widget.serializeValue = fn as never
    }
  }

  // Bridge: wire legacy widget.callback to 'change' event
  const origCallback = widget.callback
  widget.callback = (...args: unknown[]) => {
    ;(origCallback as Function)?.call(widget, ...args)
    const old = widget.value
    listeners['change']?.forEach((fn) => fn(args[0], old))
  }

  return handle
}

function createNodeHandle(
  node: LGraphNode,
  extensionName: string
): NodeHandle {
  const entityId = getNodeEntityId(node)
  const listeners: Record<string, Set<Function>> = {}

  function on(event: string, fn: Function) {
    if (!listeners[event]) listeners[event] = new Set()
    listeners[event].add(fn)

    // Auto-cleanup when scope stops
    onScopeDispose(() => {
      listeners[event]?.delete(fn)
    })
  }

  // Wire legacy LGraphNode callbacks → event dispatch.
  // Once ECS exists, these become World component watches instead.
  const origOnRemoved = node.onRemoved
  node.onRemoved = () => {
    origOnRemoved?.call(node)
    listeners['removed']?.forEach((fn) => fn())
    disposeScope(extensionName, entityId)
  }

  const origOnExecuted = node.onExecuted
  node.onExecuted = (output: Record<string, unknown>) => {
    origOnExecuted?.call(node, output)
    listeners['executed']?.forEach((fn) => fn(output))
  }

  const origOnConfigure = node.onConfigure
  node.onConfigure = function (this: LGraphNode, ...args: unknown[]) {
    origOnConfigure?.apply(this, args as never)
    listeners['configured']?.forEach((fn) => fn())
  }

  const handle: NodeHandle = {
    entityId,
    type: node.type ?? '',
    comfyClass: (node.constructor as { comfyClass?: string }).comfyClass ?? '',

    // ─── Reads (will become World.getComponent queries) ──────
    getPosition(): Point {
      return [node.pos[0], node.pos[1]]
    },
    getSize(): Size {
      return [node.size[0], node.size[1]]
    },
    getTitle() {
      return node.title
    },
    getMode() {
      return node.mode
    },
    getProperty<T = unknown>(key: string): T | undefined {
      return node.properties?.[key] as T
    },
    getProperties() {
      return { ...node.properties }
    },
    isSelected() {
      return node.is_selected ?? false
    },

    // ─── Writes (will become command dispatches) ─────────────
    setPosition(pos: Point) {
      node.pos[0] = pos[0]
      node.pos[1] = pos[1]
      listeners['positionChanged']?.forEach((fn) => fn(pos))
    },
    setSize(size: Size) {
      node.setSize(size)
      listeners['sizeChanged']?.forEach((fn) => fn(size))
    },
    setTitle(title: string) {
      node.title = title
    },
    setMode(mode) {
      node.mode = mode
      listeners['modeChanged']?.forEach((fn) => fn(mode))
    },
    setProperty(key: string, value: unknown) {
      if (!node.properties) node.properties = {}
      ;(node.properties as Record<string, unknown>)[key] = value
    },

    // ─── Widgets ─────────────────────────────────────────────
    widget(name: string) {
      const w = node.widgets?.find((w) => w.name === name)
      return w ? createWidgetHandle(w, extensionName) : undefined
    },
    widgets() {
      return (node.widgets ?? []).map((w) => createWidgetHandle(w, extensionName))
    },
    addWidget(
      type: string,
      name: string,
      defaultValue: unknown,
      options?: Partial<WidgetOptions>
    ) {
      // Bridge to legacy widget creation.
      // TODO: Replace with ECS entity creation once World exists.
      const widget = node.addCustomWidget({
        name,
        type,
        value: defaultValue,
        options: options ?? {},
        draw: () => {},
        computeSize: () => [0, 20]
      } as unknown as Parameters<typeof node.addCustomWidget>[0])
      return createWidgetHandle(widget, extensionName)
    },

    // ─── Slots ───────────────────────────────────────────────
    inputs() {
      return (node.inputs ?? []).map((input) => ({
        entityId: nextEntityId++ as unknown as SlotInfo['entityId'],
        name: input.name,
        type: String(input.type),
        direction: 'input' as const,
        nodeEntityId: entityId
      }))
    },
    outputs() {
      return (node.outputs ?? []).map((output) => ({
        entityId: nextEntityId++ as unknown as SlotInfo['entityId'],
        name: output.name,
        type: String(output.type),
        direction: 'output' as const,
        nodeEntityId: entityId
      }))
    },

    on: on as NodeHandle['on']
  }

  return handle
}

// ─── Extension Registry ──────────────────────────────────────────────

const nodeExtensions: NodeExtensionOptions[] = []
const widgetExtensions: WidgetExtensionOptions[] = []

export function defineNodeExtension(options: NodeExtensionOptions): void {
  nodeExtensions.push(options)
}

export function defineWidgetExtension(options: WidgetExtensionOptions): void {
  widgetExtensions.push(options)
}

/**
 * Called by the framework when a node is created.
 * Dispatches to all registered v2 node extensions.
 */
export function dispatchNodeCreated(node: LGraphNode): void {
  const comfyClass =
    (node.constructor as { comfyClass?: string }).comfyClass ?? ''

  for (const ext of nodeExtensions) {
    // Skip if this extension filters to specific types and this node isn't one
    if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue
    if (!ext.nodeCreated) continue

    const entityId = getNodeEntityId(node)
    const scope = getOrCreateScope(ext.name, entityId)

    scope.run(() => {
      const handle = createNodeHandle(node, ext.name)
      ext.nodeCreated!(handle)
    })
  }
}

/**
 * Called by the framework when a node is loaded from a saved workflow.
 */
export function dispatchLoadedGraphNode(node: LGraphNode): void {
  const comfyClass =
    (node.constructor as { comfyClass?: string }).comfyClass ?? ''

  for (const ext of nodeExtensions) {
    if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue
    if (!ext.loadedGraphNode) continue

    const entityId = getNodeEntityId(node)
    const scope = getOrCreateScope(ext.name, entityId)

    scope.run(() => {
      const handle = createNodeHandle(node, ext.name)
      ext.loadedGraphNode!(handle)
    })
  }
}
