/**
 * Extension V2 Service
 *
 * Manages extension lifecycle: scope creation, handle construction,
 * reactive dispatch. The extension system watches the ECS World for
 * entity creation/removal and auto-mounts/unmounts extension scopes.
 *
 * Pattern mirrors Vue's setupStatefulComponent (component.ts:829-927):
 * - scope.run() activates the EffectScope (like setCurrentInstance)
 * - pauseTracking() prevents accidental deps during setup
 * - All watches/effects created inside scope.run() are captured
 * - scope.stop() on entity removal cleans up everything
 *
 * See decisions/D3.5-reactive-dispatch-and-scope-alignment.md
 */

import {
  EffectScope,
  onScopeDispose,
  pauseTracking,
  resetTracking,
  watch
} from 'vue'

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
  LoadedFromWorkflow
} from '@/ecs/components'
import type {
  NodeEntityId,
  WidgetEntityId,
  SlotEntityId
} from '@/ecs/entityIds'

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
// One EffectScope per extension+entity pair. Disposed when the entity is
// removed from the World (detected by the reactive mount watcher).

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

function stopScope(extensionName: string, entityId: number): void {
  const key = `${extensionName}:${entityId}`
  const scope = scopeRegistry.get(key)
  if (scope) {
    scope.stop()
    scopeRegistry.delete(key)
  }
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
      return (
        world.getComponent(widgetId, WidgetValue).options?.hidden ?? false
      )
    },
    setHidden(hidden: boolean) {
      dispatch({
        type: 'SetWidgetOption',
        widgetId,
        key: 'hidden',
        value: hidden
      })
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
        watch(
          () => world.getComponent(nodeId, Position).pos,
          (pos) => fn(pos)
        )
      } else if (event === 'sizeChanged') {
        watch(
          () => world.getComponent(nodeId, Dimensions).size,
          (s) => fn(s)
        )
      } else if (event === 'modeChanged') {
        watch(
          () => world.getComponent(nodeId, Execution).mode,
          (m) => fn(m)
        )
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

// ─── Extension Registry ──────────────────────────────────────────────

const nodeExtensions: NodeExtensionOptions[] = []
const widgetExtensions: WidgetExtensionOptions[] = []

export function defineNodeExtension(options: NodeExtensionOptions): void {
  nodeExtensions.push(options)
}

export function defineWidgetExtension(options: WidgetExtensionOptions): void {
  widgetExtensions.push(options)
}

// ─── Reactive Mount System ───────────────────────────────────────────
// Watches the World for entity creation/removal. When a NodeType
// component appears, extensions are mounted for that entity. When it
// disappears, all extension scopes for that entity are stopped.
//
// This replaces the imperative dispatchNodeCreated/dispatchLoadedGraphNode
// pattern. The World is the single source of truth — if an entity
// exists, its extensions are mounted.

/**
 * Mount extensions for a newly detected node entity.
 *
 * Follows Vue's setupStatefulComponent pattern:
 * 1. scope.run() activates the EffectScope
 * 2. pauseTracking() prevents accidental dependency tracking
 * 3. Extension hook runs — explicit watches via node.on() are captured
 * 4. resetTracking() restores tracking state
 */
function mountExtensionsForNode(nodeId: NodeEntityId): void {
  const world = useWorld()
  const comfyClass = world.getComponent(nodeId, NodeType).comfyClass
  const isLoaded = world.hasComponent(nodeId, LoadedFromWorkflow)

  for (const ext of nodeExtensions) {
    if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue

    const hook = isLoaded ? ext.loadedGraphNode : ext.nodeCreated
    if (!hook) continue

    const scope = getOrCreateScope(ext.name, nodeId)
    scope.run(() => {
      pauseTracking()
      try {
        hook(createNodeHandle(nodeId))
      } finally {
        resetTracking()
      }
    })
  }
}

/**
 * Unmount all extension scopes for a removed node entity.
 * scope.stop() disposes all watches, computed, and onScopeDispose
 * callbacks created during the extension's setup.
 */
function unmountExtensionsForNode(nodeId: NodeEntityId): void {
  for (const ext of nodeExtensions) {
    stopScope(ext.name, nodeId)
  }
}

/**
 * Start the reactive extension mount system.
 *
 * Called once during app initialization. Watches the World's entity list
 * and auto-mounts/unmounts extensions as entities appear/disappear.
 *
 * This means no code path (add node, paste, load workflow, undo, CRDT
 * sync) needs to manually call a dispatch function — the World is the
 * single source of truth.
 */
export function startExtensionSystem(): void {
  const world = useWorld()

  watch(
    () => world.queryAll(NodeType),
    (currentIds, previousIds) => {
      const prev = new Set(previousIds ?? [])
      const curr = new Set(currentIds)

      for (const nodeId of currentIds) {
        if (!prev.has(nodeId)) {
          mountExtensionsForNode(nodeId)
        }
      }

      for (const nodeId of previousIds ?? []) {
        if (!curr.has(nodeId)) {
          unmountExtensionsForNode(nodeId)
        }
      }
    },
    { flush: 'post' }
  )
}
