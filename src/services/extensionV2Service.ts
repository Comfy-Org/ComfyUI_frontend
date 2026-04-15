/**
 * Extension V2 Service
 *
 * Manages extension lifecycle: scope creation, handle construction,
 * hook dispatch. Imports from the ECS world/command layer directly.
 */

import { EffectScope, onScopeDispose, watch } from 'vue'

// These modules don't exist yet — they will be created as part of ADR 0008.
import { useWorld } from '@/ecs/world'
import { dispatch } from '@/ecs/commands'
import {
  Position,
  Dimensions,
  NodeVisual,
  NodeType,
  Execution,
  WidgetValue,
  WidgetIdentity,
  WidgetContainer,
  Connectivity,
  SlotIdentity,
  SlotConnection
} from '@/ecs/components'
import type { NodeEntityId, WidgetEntityId, SlotEntityId } from '@/ecs/entityIds'

import type {
  NodeExtensionOptions,
  NodeHandle,
  WidgetExtensionOptions,
  WidgetHandle,
  WidgetOptions,
  SlotInfo,
  Point,
  Size
} from '@/types/extensionV2'

// ─── Scope Registry ──────────────────────────────────────────────────
// One EffectScope per extension+node pair. Disposed when entity is
// removed from the World.

const scopeRegistry = new Map<string, EffectScope>()

function getOrCreateScope(
  extensionName: string,
  entityId: number
): EffectScope {
  const key = `${extensionName}:${entityId}`
  let scope = scopeRegistry.get(key)
  if (!scope) {
    scope = new EffectScope(true)
    scopeRegistry.set(key, scope)
  }
  return scope
}

// ─── WidgetHandle ────────────────────────────────────────────────────

function createWidgetHandle(widgetId: WidgetEntityId): WidgetHandle {
  const world = useWorld()

  return {
    entityId: widgetId,
    get name() {
      return world.getComponent(widgetId, WidgetIdentity).name
    },
    get widgetType() {
      return world.getComponent(widgetId, WidgetIdentity).type
    },

    getValue<T = unknown>(): T {
      return world.getComponent(widgetId, WidgetValue).value as T
    },
    setValue(value: unknown) {
      dispatch({ type: 'SetWidgetValue', widgetId, value })
    },

    isHidden() {
      return world.getComponent(widgetId, WidgetValue).options?.hidden ?? false
    },
    setHidden(hidden: boolean) {
      dispatch({ type: 'SetWidgetOption', widgetId, key: 'hidden', value: hidden })
    },
    getOptions(): WidgetOptions {
      return world.getComponent(widgetId, WidgetValue).options ?? {}
    },
    setOption(key: string, value: unknown) {
      dispatch({ type: 'SetWidgetOption', widgetId, key, value })
    },
    setLabel(label: string) {
      dispatch({ type: 'SetWidgetLabel', widgetId, label })
    },

    on(event: string, fn: Function) {
      if (event === 'change') {
        watch(
          () => world.getComponent(widgetId, WidgetValue).value,
          (newVal, oldVal) => fn(newVal, oldVal)
        )
      }
      if (event === 'removed') {
        onScopeDispose(() => fn())
      }
    },

    setSerializeValue(fn) {
      dispatch({ type: 'SetWidgetSerializer', widgetId, serializer: fn })
    }
  }
}

// ─── NodeHandle ──────────────────────────────────────────────────────

function createNodeHandle(nodeId: NodeEntityId): NodeHandle {
  const world = useWorld()

  return {
    entityId: nodeId,
    get type() {
      return world.getComponent(nodeId, NodeType).type
    },
    get comfyClass() {
      return world.getComponent(nodeId, NodeType).comfyClass
    },

    // Reads — direct World queries
    getPosition(): Point {
      return world.getComponent(nodeId, Position).pos
    },
    getSize(): Size {
      return world.getComponent(nodeId, Dimensions).size
    },
    getTitle() {
      return world.getComponent(nodeId, NodeVisual).title
    },
    getMode() {
      return world.getComponent(nodeId, Execution).mode
    },
    getProperty<T = unknown>(key: string): T | undefined {
      return world.getComponent(nodeId, NodeType).properties?.[key] as T
    },
    getProperties() {
      return { ...world.getComponent(nodeId, NodeType).properties }
    },
    isSelected() {
      return world.getComponent(nodeId, NodeVisual).selected ?? false
    },

    // Writes — command dispatches
    setPosition(pos: Point) {
      dispatch({ type: 'MoveNode', nodeId, pos })
    },
    setSize(size: Size) {
      dispatch({ type: 'ResizeNode', nodeId, size })
    },
    setTitle(title: string) {
      dispatch({ type: 'SetNodeVisual', nodeId, patch: { title } })
    },
    setMode(mode) {
      dispatch({ type: 'SetNodeMode', nodeId, mode })
    },
    setProperty(key: string, value: unknown) {
      dispatch({ type: 'SetNodeProperty', nodeId, key, value })
    },

    // Widgets
    widget(name: string) {
      const container = world.getComponent(nodeId, WidgetContainer)
      const widgetId = container.widgetIds.find((id) => {
        return world.getComponent(id, WidgetIdentity).name === name
      })
      return widgetId ? createWidgetHandle(widgetId) : undefined
    },
    widgets() {
      const container = world.getComponent(nodeId, WidgetContainer)
      return container.widgetIds.map(createWidgetHandle)
    },
    addWidget(type, name, defaultValue, options) {
      const widgetId = dispatch({
        type: 'CreateWidget',
        parentNodeId: nodeId,
        widgetType: type,
        name,
        defaultValue,
        options
      })
      return createWidgetHandle(widgetId)
    },

    // Slots
    inputs() {
      const conn = world.getComponent(nodeId, Connectivity)
      return conn.inputSlotIds.map((slotId) => {
        const slot = world.getComponent(slotId, SlotIdentity)
        return {
          entityId: slotId,
          name: slot.name,
          type: slot.type,
          direction: 'input' as const,
          nodeEntityId: nodeId
        } satisfies SlotInfo
      })
    },
    outputs() {
      const conn = world.getComponent(nodeId, Connectivity)
      return conn.outputSlotIds.map((slotId) => {
        const slot = world.getComponent(slotId, SlotIdentity)
        return {
          entityId: slotId,
          name: slot.name,
          type: slot.type,
          direction: 'output' as const,
          nodeEntityId: nodeId
        } satisfies SlotInfo
      })
    },

    // Events — backed by World component watches
    on(event: string, fn: Function) {
      if (event === 'positionChanged') {
        watch(() => world.getComponent(nodeId, Position).pos, (pos) => fn(pos))
      } else if (event === 'sizeChanged') {
        watch(() => world.getComponent(nodeId, Dimensions).size, (s) => fn(s))
      } else if (event === 'modeChanged') {
        watch(() => world.getComponent(nodeId, Execution).mode, (m) => fn(m))
      } else if (event === 'executed') {
        world.onSystemEvent(nodeId, 'executed', fn)
      } else if (event === 'connected') {
        world.onSystemEvent(nodeId, 'connected', fn)
      } else if (event === 'disconnected') {
        world.onSystemEvent(nodeId, 'disconnected', fn)
      } else if (event === 'configured') {
        world.onSystemEvent(nodeId, 'configured', fn)
      } else if (event === 'removed') {
        onScopeDispose(() => fn())
      }
    }
  }
}

// ─── Extension Registry & Dispatch ───────────────────────────────────

const nodeExtensions: NodeExtensionOptions[] = []
const widgetExtensions: WidgetExtensionOptions[] = []

export function defineNodeExtension(options: NodeExtensionOptions): void {
  nodeExtensions.push(options)
}

export function defineWidgetExtension(options: WidgetExtensionOptions): void {
  widgetExtensions.push(options)
}

/** Called by the framework when a node entity is created in the World. */
export function dispatchNodeCreated(nodeId: NodeEntityId): void {
  const world = useWorld()
  const comfyClass = world.getComponent(nodeId, NodeType).comfyClass

  for (const ext of nodeExtensions) {
    if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue
    if (!ext.nodeCreated) continue

    const scope = getOrCreateScope(ext.name, nodeId)
    scope.run(() => {
      ext.nodeCreated!(createNodeHandle(nodeId))
    })
  }
}

/** Called by the framework when a node is loaded from a saved workflow. */
export function dispatchLoadedGraphNode(nodeId: NodeEntityId): void {
  const world = useWorld()
  const comfyClass = world.getComponent(nodeId, NodeType).comfyClass

  for (const ext of nodeExtensions) {
    if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue
    if (!ext.loadedGraphNode) continue

    const scope = getOrCreateScope(ext.name, nodeId)
    scope.run(() => {
      ext.loadedGraphNode!(createNodeHandle(nodeId))
    })
  }
}
