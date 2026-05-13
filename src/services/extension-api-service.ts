/**
 * Extension API Service
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
 * See decisions/D10-lifecycle-context-and-ordering.md
 * See research/architecture/scope-registry-spike.md (I-SR.2.B1)
 */

import { EffectScope, onScopeDispose, proxyRefs, watch } from 'vue'

// Phase A no-op stub for the Vue `pauseTracking`/`resetTracking` pair.
//
// In Vue's `setupStatefulComponent` (component.ts:829-927) these calls bracket
// `setup()` so that any property reads inside the user's setup body do NOT
// register as reactive dependencies of the surrounding effect. We mirror that
// pattern in the extension scope harness.
//
// We intentionally do NOT take a direct dependency on `@vue/reactivity` for
// Phase A — the contract being stabilized here is the API surface, not the
// dep-tracking guarantee. Real bracketing lands together with the reactive
// World contract in #11939 (Phase B), at which point these stubs are replaced
// by `import { pauseTracking, resetTracking } from '@vue/reactivity'`.
//
// TODO(#11939): swap in the real pauseTracking/resetTracking from
// @vue/reactivity once the reactive-World contract is live.
const pauseTracking = (): void => {}
const resetTracking = (): void => {}

import { getWorld } from '@/world/worldInstance'
import {
  WidgetComponentContainer,
  WidgetComponentDisplay,
  WidgetComponentSchema,
  WidgetComponentSerialize,
  WidgetComponentValue
} from '@/world/widgets/widgetComponents'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'
import { defineComponentKey } from '@/world/componentKey'

import type {
  NodeHandle,
  NodeMode,
  SlotInfo,
  SlotEntityId as PublicSlotEntityId,
  Point,
  Size,
  DOMWidgetOptions
} from '@/extension-api/node'
import type { WidgetHandle } from '@/extension-api/widget'
import type { Unsubscribe } from '@/extension-api/events'
import type {
  ExtensionOptions,
  NodeExtensionOptions,
  WidgetExtensionOptions
} from '@/extension-api/types'

// ─── Stub component keys ─────────────────────────────────────────────────────
// Node-level components (Position, Dimensions, NodeType, etc.) are not yet in
// the World — they land with Alex's PR #11939 (ECS substrate slice 2).
// These stubs let the scope registry compile and run today; each will be
// replaced by the real key from @/world/nodeComponents once that module ships.
// TODO(#11939): replace all stubs below with real imports

interface NodeTypeData {
  type: string
  comfyClass: string
  properties?: Record<string, unknown>
}
interface LoadedFromWorkflowData {
  _tag: 'LoadedFromWorkflow'
}
interface PositionData {
  pos: Point
}
interface DimensionsData {
  size: Size
}
interface NodeVisualData {
  title: string
  selected?: boolean
}
interface ExecutionData {
  mode: number
}
type SlotEntityId = string & { __brand: 'SlotEntityId' }
interface ConnectivityData {
  inputSlotIds: SlotEntityId[]
  outputSlotIds: SlotEntityId[]
}
interface SlotIdentityData {
  name: string
  type: string
}

const NodeTypeKey = defineComponentKey<NodeTypeData, NodeEntityId>('NodeType')
const LoadedFromWorkflowKey = defineComponentKey<
  LoadedFromWorkflowData,
  NodeEntityId
>('LoadedFromWorkflow')
const PositionKey = defineComponentKey<PositionData, NodeEntityId>('Position')
const DimensionsKey = defineComponentKey<DimensionsData, NodeEntityId>(
  'Dimensions'
)
const NodeVisualKey = defineComponentKey<NodeVisualData, NodeEntityId>(
  'NodeVisual'
)
const ExecutionKey = defineComponentKey<ExecutionData, NodeEntityId>(
  'Execution'
)
const ConnectivityKey = defineComponentKey<ConnectivityData, NodeEntityId>(
  'Connectivity'
)
// SlotIdentity reads from the slot sub-id space; cast to WidgetEntityId brand for now
// TODO(#11939): introduce SlotEntityId brand in @/world/entityIds
const SlotIdentityKey = defineComponentKey<SlotIdentityData, WidgetEntityId>(
  'SlotIdentity'
)

// TODO(#11939): replace with real dispatch from @/world/commands
// _dispatchImpl is reassignable for testing. Do not use outside tests.
let _dispatchImpl: ((cmd: Record<string, unknown>) => unknown) | null = null

/**
 * @internal
 * @publicAPI
 * Test-only: override dispatch implementation. Pass null to restore the stub.
 * DO NOT use in extensions — this is an internal testing hook used by the
 * test framework PR (#12145) and Phase B ECS dispatch tests.
 */
export function _setDispatchImplForTesting(
  impl: ((cmd: Record<string, unknown>) => unknown) | null
): void {
  _dispatchImpl = impl
}

function dispatch(_command: Record<string, unknown>): unknown {
  if (_dispatchImpl) return _dispatchImpl(_command)
  if (import.meta.env.DEV) {
    console.warn(
      '[extension-api] dispatch() is a stub — ECS commands land with PR #11939',
      _command
    )
  }
  return undefined
}

// ─── NodeInstanceScope ───────────────────────────────────────────────────────
// Mirrors Vue's ComponentInternalInstance + EffectScope pair.
// One scope per (extension, nodeEntityId). Lifetime = node entity lifetime.
// Survives DOM moves (graph↔app mode, subgraph promotion) — only destroyed
// on graph deletion (world entitiesWith diff triggers unmount).
// See decisions/D3.5, D10, D12.

/**
 * @publicAPI
 * Per-(extension, node) scope record. Exposed so the test framework PR
 * (#12145) and Phase B dispatch can introspect scope binding.
 */
export interface NodeInstanceScope {
  /** Branded entity ID this scope is bound to. */
  readonly nodeEntityId: NodeEntityId
  /** Extension name (D10b: used for hook ordering + scope key). */
  readonly extensionName: string
  /**
   * proxyRefs-wrapped return value from setup() (D10d).
   * `extensionState['my-ext'].count` works without `.value`.
   */
  extensionState: Record<string, unknown>
  /** The underlying Vue EffectScope. Detached (not child of any other scope). */
  readonly scope: EffectScope
}

// ─── Scope Registry ──────────────────────────────────────────────────────────
// Key: `${extensionName}:${nodeEntityId}` — unambiguous because NodeEntityId
// already embeds a `node:` prefix (format: `node:${graphUuid}:${nodeId}`).

const scopeRegistry = new Map<string, NodeInstanceScope>()

function scopeKey(extensionName: string, nodeEntityId: NodeEntityId): string {
  return `${extensionName}:${nodeEntityId}`
}

function getOrCreateScope(
  extensionName: string,
  nodeEntityId: NodeEntityId
): NodeInstanceScope {
  const key = scopeKey(extensionName, nodeEntityId)
  let record = scopeRegistry.get(key)
  if (!record) {
    record = {
      nodeEntityId,
      extensionName,
      extensionState: {},
      scope: new EffectScope(true) // detached — intentionally not a child of any rendering scope
    }
    scopeRegistry.set(key, record)
  }
  return record
}

function stopScope(extensionName: string, nodeEntityId: NodeEntityId): void {
  const key = scopeKey(extensionName, nodeEntityId)
  const record = scopeRegistry.get(key)
  if (record) {
    record.scope.stop()
    scopeRegistry.delete(key)
  }
}

// ─── WidgetHandle ────────────────────────────────────────────────────────────

function createWidgetHandle(widgetId: WidgetEntityId): WidgetHandle {
  const world = getWorld()

  // `on` is implemented as a single polymorphic function; cast satisfies the
  // typed overload signature in the WidgetHandle interface.
  return {
    entityId: widgetId,

    get name() {
      // Entity ID format: "widget:graphId:nodeId:name" — the name is the last segment.
      // TODO(#11939): replace with a dedicated WidgetName component when available.
      const raw = widgetId as unknown as string
      const lastColon = raw.lastIndexOf(':')
      return lastColon !== -1 ? raw.slice(lastColon + 1) : raw
    },
    get widgetType() {
      return world.getComponent(widgetId, WidgetComponentSchema)?.type ?? ''
    },
    get label() {
      return world.getComponent(widgetId, WidgetComponentDisplay)?.label ?? ''
    },

    getValue<T = unknown>(): T {
      return (world.getComponent(widgetId, WidgetComponentValue)?.value ??
        undefined) as T
    },
    setValue(value: unknown) {
      dispatch({ type: 'SetWidgetValue', widgetId, value })
    },

    isHidden() {
      return (
        world.getComponent(widgetId, WidgetComponentDisplay)?.hidden ?? false
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

    isDisabled() {
      return (
        world.getComponent(widgetId, WidgetComponentDisplay)?.disabled ?? false
      )
    },
    setDisabled(disabled: boolean) {
      dispatch({
        type: 'SetWidgetOption',
        widgetId,
        key: 'disabled',
        value: disabled
      })
    },

    isSerializeEnabled() {
      return (
        world.getComponent(widgetId, WidgetComponentSerialize)?.serialize ??
        true
      )
    },
    setSerializeEnabled(enabled: boolean) {
      dispatch({
        type: 'SetWidgetOption',
        widgetId,
        key: 'serialize',
        value: enabled
      })
    },

    getOption<K = unknown>(key: string): K | undefined {
      const opts = world.getComponent(widgetId, WidgetComponentSchema)?.options
      return (opts as Record<string, unknown> | undefined)?.[key] as
        | K
        | undefined
    },
    setOption(key: string, value: unknown) {
      dispatch({ type: 'SetWidgetOption', widgetId, key, value })
    },

    setHeight(px: number) {
      // TODO(#11939): dispatch ResizeDOMWidget command once ECS DOM widget component lands.
      dispatch({
        type: 'SetWidgetOption',
        widgetId,
        key: '__domHeight',
        value: px
      })
    },

    on: ((event: string, fn: (...args: unknown[]) => unknown): Unsubscribe => {
      if (event === 'valueChange') {
        return watch(
          () => world.getComponent(widgetId, WidgetComponentValue)?.value,
          (newValue, oldValue) => fn({ newValue, oldValue })
        )
      } else if (event === 'optionChange' || event === 'propertyChange') {
        // TODO(#11939): wire through ECS event bus when available
        dispatch({ type: 'SubscribeWidgetEvent', widgetId, event, handler: fn })
        return () =>
          dispatch({
            type: 'UnsubscribeWidgetEvent',
            widgetId,
            event,
            handler: fn
          })
      } else if (event === 'beforeSerialize') {
        dispatch({ type: 'RegisterWidgetSerializer', widgetId, serializer: fn })
        return () =>
          dispatch({
            type: 'UnregisterWidgetSerializer',
            widgetId,
            serializer: fn
          })
      } else if (event === 'beforeQueue') {
        dispatch({
          type: 'RegisterWidgetQueueValidator',
          widgetId,
          validator: fn
        })
        return () =>
          dispatch({
            type: 'UnregisterWidgetQueueValidator',
            widgetId,
            validator: fn
          })
      }
      if (import.meta.env.DEV) {
        console.warn(`[extension-api] Unknown widget event: "${event}"`)
      }
      return () => {}
    }) as WidgetHandle['on']
  }
}

// ─── NodeHandle ──────────────────────────────────────────────────────────────

function createNodeHandle(nodeId: NodeEntityId): NodeHandle {
  const world = getWorld()

  return {
    entityId: nodeId,

    get type() {
      return world.getComponent(nodeId, NodeTypeKey)?.type ?? ''
    },
    get comfyClass() {
      return world.getComponent(nodeId, NodeTypeKey)?.comfyClass ?? ''
    },

    getPosition(): Point {
      return world.getComponent(nodeId, PositionKey)?.pos ?? [0, 0]
    },
    getSize(): Size {
      return world.getComponent(nodeId, DimensionsKey)?.size ?? [0, 0]
    },
    getTitle() {
      return world.getComponent(nodeId, NodeVisualKey)?.title ?? ''
    },
    getMode() {
      const numericMode = world.getComponent(nodeId, ExecutionKey)?.mode ?? 0
      const modeMap: Record<number, NodeMode> = {
        0: 'always',
        1: 'never',
        2: 'bypass',
        3: 'once',
        4: 'onTrigger'
      }
      return modeMap[numericMode] ?? 'always'
    },

    getProperty<T = unknown>(key: string): T | undefined {
      return world.getComponent(nodeId, NodeTypeKey)?.properties?.[key] as T
    },
    getProperties() {
      return { ...world.getComponent(nodeId, NodeTypeKey)?.properties }
    },

    isSelected() {
      return world.getComponent(nodeId, NodeVisualKey)?.selected ?? false
    },

    setPosition(pos: Point) {
      dispatch({ type: 'MoveNode', nodeId, pos })
    },
    setSize(size: Size) {
      dispatch({ type: 'ResizeNode', nodeId, size })
    },
    setTitle(title: string) {
      dispatch({ type: 'SetNodeVisual', nodeId, patch: { title } })
    },
    setMode(mode: NodeMode) {
      const numericModeMap: Record<NodeMode, number> = {
        always: 0,
        never: 1,
        bypass: 2,
        once: 3,
        onTrigger: 4
      }
      dispatch({ type: 'SetNodeMode', nodeId, mode: numericModeMap[mode] })
    },
    setProperty(key: string, value: unknown) {
      dispatch({ type: 'SetNodeProperty', nodeId, key, value })
    },

    getWidget(name: string) {
      const container = world.getComponent(nodeId, WidgetComponentContainer)
      const widgetId = container?.widgetIds.find((id: WidgetEntityId) => {
        // Widget name is embedded in the entity ID format: widget:graphId:nodeId:name
        // TODO(#11939): use a dedicated WidgetName component key instead of parsing ID
        return (id as unknown as string).endsWith(`:${name}`)
      })
      return widgetId ? createWidgetHandle(widgetId) : undefined
    },
    widgets() {
      const container = world.getComponent(nodeId, WidgetComponentContainer)
      return (container?.widgetIds ?? []).map(createWidgetHandle)
    },
    addWidget(type, name, defaultValue, options) {
      const widgetId = dispatch({
        type: 'CreateWidget',
        parentNodeId: nodeId,
        widgetType: type,
        name,
        defaultValue,
        options
      }) as WidgetEntityId
      return createWidgetHandle(widgetId)
    },

    addDOMWidget(opts: DOMWidgetOptions) {
      // TODO(#11939): dispatch CreateDOMWidget command once ECS DOM widget component lands.
      // For Phase A we register a regular widget with type 'DOM' and store the element
      // reference on the options bag. Auto-cleanup is wired via onScopeDispose.
      const widgetId = dispatch({
        type: 'CreateWidget',
        parentNodeId: nodeId,
        widgetType: 'DOM',
        name: opts.name,
        defaultValue: null,
        options: {
          __domElement: opts.element,
          __domHeight: opts.height ?? opts.element.offsetHeight
        }
      }) as WidgetEntityId
      onScopeDispose(() => {
        opts.element.remove()
      })
      return createWidgetHandle(widgetId)
    },

    inputs() {
      const conn = world.getComponent(nodeId, ConnectivityKey)
      return (conn?.inputSlotIds ?? []).map((slotId: SlotEntityId) => {
        const slot = world.getComponent(
          slotId as unknown as WidgetEntityId,
          SlotIdentityKey
        )
        return {
          entityId: slotId as unknown as PublicSlotEntityId,
          name: slot?.name ?? '',
          type: slot?.type ?? '',
          direction: 'input' as const,
          nodeEntityId: nodeId
        } satisfies SlotInfo
      })
    },
    outputs() {
      const conn = world.getComponent(nodeId, ConnectivityKey)
      return (conn?.outputSlotIds ?? []).map((slotId: SlotEntityId) => {
        const slot = world.getComponent(
          slotId as unknown as WidgetEntityId,
          SlotIdentityKey
        )
        return {
          entityId: slotId as unknown as PublicSlotEntityId,
          name: slot?.name ?? '',
          type: slot?.type ?? '',
          direction: 'output' as const,
          nodeEntityId: nodeId
        } satisfies SlotInfo
      })
    },

    on: ((event: string, fn: (...args: unknown[]) => unknown): Unsubscribe => {
      if (event === 'positionChanged') {
        return watch(
          () => world.getComponent(nodeId, PositionKey)?.pos,
          (pos) => pos && fn(pos)
        )
      } else if (event === 'sizeChanged') {
        return watch(
          () => world.getComponent(nodeId, DimensionsKey)?.size,
          (s) => s && fn(s)
        )
      } else if (event === 'modeChanged') {
        return watch(
          () => world.getComponent(nodeId, ExecutionKey)?.mode,
          (m) => m !== undefined && fn(m)
        )
      } else if (
        event === 'executed' ||
        event === 'connected' ||
        event === 'disconnected' ||
        event === 'configured'
      ) {
        // TODO(#11939): replace with world.onSystemEvent once World interface gains it
        dispatch({ type: 'SubscribeNodeEvent', nodeId, event, handler: fn })
        return () =>
          dispatch({ type: 'UnsubscribeNodeEvent', nodeId, event, handler: fn })
      } else if (event === 'removed') {
        // onScopeDispose fires when the EffectScope for this extension+node is stopped,
        // which happens in unmountExtensionsForNode — exactly when the node is removed.
        onScopeDispose(() => fn())
        return () => {} // cleanup handled by scope.stop()
      }
      if (import.meta.env.DEV) {
        console.warn(`[extension-api] Unknown node event: "${event}"`)
      }
      return () => {}
    }) as NodeHandle['on']
  }
}

// ─── currentExtension global slot (D10a) ─────────────────────────────────────
// Mirrors Vue's currentInstance pattern. Set immediately before invoking
// nodeCreated/loadedGraphNode, cleared immediately after. Hook factories
// (onNodeMounted, onNodeRemoved) read this slot — must be called synchronously
// during setup or they throw in dev / no-op in prod.

let _currentScope: NodeInstanceScope | null = null

export function getCurrentScope(): NodeInstanceScope | null {
  return _currentScope
}

/**
 * Register a callback that fires after setup() completes for this node entity
 * (post-flush, still within the active EffectScope).
 * Must be called synchronously inside nodeCreated / loadedGraphNode (D10a).
 */
export function onNodeMounted(fn: () => void): void {
  if (!_currentScope) {
    if (import.meta.env.DEV) {
      throw new Error(
        '[extension-api] onNodeMounted() called outside setup context. ' +
          'Call it synchronously inside nodeCreated or loadedGraphNode (D10a).'
      )
    }
    return
  }
  // Post-flush once-watcher: fires after the current synchronous setup chain,
  // still inside the active EffectScope so it is automatically cleaned up.
  // immediate: true ensures the callback fires even with no reactive deps.
  watch(() => null, fn, { flush: 'post', once: true, immediate: true })
}

/**
 * Register a callback that fires when the node entity is removed from the graph.
 * Does NOT fire on subgraph promotion (DOM-move, not unmount).
 * Must be called synchronously inside nodeCreated / loadedGraphNode (D10a).
 */
export function onNodeRemoved(fn: () => void): void {
  if (!_currentScope) {
    if (import.meta.env.DEV) {
      throw new Error(
        '[extension-api] onNodeRemoved() called outside setup context. ' +
          'Call it synchronously inside nodeCreated or loadedGraphNode (D10a).'
      )
    }
    return
  }
  onScopeDispose(fn)
}

// ─── Extension Registry ──────────────────────────────────────────────────────

const appExtensions: ExtensionOptions[] = []
const nodeExtensions: NodeExtensionOptions[] = []
const widgetExtensions: WidgetExtensionOptions[] = []

export function defineExtension(options: ExtensionOptions): void {
  appExtensions.push(options)
}

export function defineNodeExtension(options: NodeExtensionOptions): void {
  nodeExtensions.push(options)
}

export function defineWidgetExtension(options: WidgetExtensionOptions): void {
  widgetExtensions.push(options)
}

/** @internal Test-only: clear all registered extensions and reset state. */
export function _clearExtensionsForTesting(): void {
  nodeExtensions.length = 0
  appExtensions.length = 0
  widgetExtensions.length = 0
  _extensionSystemStarted = false
}

// ─── Mount / Unmount ─────────────────────────────────────────────────────────

/**
 * Mount extensions for a newly detected node entity.
 *
 * Follows Vue's setupStatefulComponent pattern (D3.5, D10):
 * 1. getOrCreateScope() allocates the NodeInstanceScope
 * 2. scope.run() activates the EffectScope
 * 3. pauseTracking() prevents accidental reactive deps on setup args
 * 4. Extension hook runs — node.on() calls inside are captured in scope
 * 5. resetTracking() restores state
 * 6. Return value is proxyRefs-wrapped (D10d) and stored as extensionState
 *
 * Hook firing order: lexicographic by extension name (D10b).
 * Setup is synchronous (D10c) — async setup warns in prod, throws in dev.
 */
export function mountExtensionsForNode(nodeEntityId: NodeEntityId): void {
  const world = getWorld()
  const nodeType = world.getComponent(nodeEntityId, NodeTypeKey)
  if (!nodeType) return

  const { comfyClass } = nodeType
  const isLoaded =
    world.getComponent(nodeEntityId, LoadedFromWorkflowKey) !== undefined

  // D10b: lexicographic order on extension name as stable tie-break
  const sorted = [...nodeExtensions].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  for (const ext of sorted) {
    if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue

    const hook = isLoaded ? ext.loadedGraphNode : ext.nodeCreated
    if (!hook) continue

    // Idempotency: if scope already exists, setup has already run — skip.
    const key = scopeKey(ext.name, nodeEntityId)
    if (scopeRegistry.has(key)) continue

    const record = getOrCreateScope(ext.name, nodeEntityId)

    let setupReturn: Record<string, unknown> = {}
    record.scope.run(() => {
      // D10a: set currentScope so onNodeMounted/onNodeRemoved can read it
      const prevScope = _currentScope
      _currentScope = record
      pauseTracking()
      try {
        const result: unknown = hook(createNodeHandle(nodeEntityId))
        if (result instanceof Promise) {
          // Async setup is not supported (D10c) — catch to prevent unhandled rejection
          result.catch((err) => {
            console.error(
              `[extension-api] Async error in extension "${ext.name}" setup:`,
              err
            )
          })
          if (import.meta.env.DEV) {
            throw new Error(
              `[extension-api] Extension "${ext.name}" returned a Promise from setup. ` +
                'setup() must be synchronous (D10c).'
            )
          } else {
            console.error(
              `[extension-api] Extension "${ext.name}" returned a Promise from setup — ` +
                'async setup is not supported (D10c).'
            )
          }
        } else if (result && typeof result === 'object') {
          setupReturn = result as Record<string, unknown>
        }
      } finally {
        resetTracking()
        _currentScope = prevScope
      }
    })

    // D10d: proxyRefs so callers read .count instead of .count.value
    record.extensionState = proxyRefs(setupReturn) as Record<string, unknown>
  }
}

/**
 * Unmount all extension scopes for a removed node entity.
 * scope.stop() disposes all watches, computed, and onScopeDispose callbacks —
 * including any `node.on('removed', fn)` handlers registered during setup.
 */
export function unmountExtensionsForNode(nodeEntityId: NodeEntityId): void {
  for (const ext of nodeExtensions) {
    stopScope(ext.name, nodeEntityId)
  }
}

/**
 * Read-only view of the scope registry — for tests and debug tooling.
 */
export function getScopeRegistry(): ReadonlyMap<
  string,
  Readonly<NodeInstanceScope>
> {
  return scopeRegistry
}

// ─── Reactive Mount System ───────────────────────────────────────────────────
// Watches the World for entity creation/removal via world.entitiesWith().
// The World's component buckets are reactive(Map), so this watch fires
// whenever NodeType entities are added or removed — no imperative dispatch
// needed. See scope-registry-spike.md §3 and decisions/D3.5.
// TODO(D8): World reactivity is not yet wired — this watch won't fire in
// Phase A. The design for reactive World (D8) is still unresolved.

let _extensionSystemStarted = false

export function startExtensionSystem(): void {
  if (_extensionSystemStarted) {
    if (import.meta.env.DEV) {
      console.warn(
        '[extension-api] startExtensionSystem() called multiple times'
      )
    }
    return
  }
  _extensionSystemStarted = true

  const world = getWorld()

  watch(
    () => world.entitiesWith(NodeTypeKey),
    (currentIds, previousIds) => {
      const prev = new Set(previousIds ?? [])
      const curr = new Set(currentIds)

      for (const nodeId of currentIds) {
        if (!prev.has(nodeId)) mountExtensionsForNode(nodeId)
      }

      for (const nodeId of previousIds ?? []) {
        if (!curr.has(nodeId)) unmountExtensionsForNode(nodeId)
      }
    },
    { flush: 'post' }
  )
}

/**
 * Invoke app-level v2 extension hooks (`init` or `setup`) for all registered
 * `defineExtension()` calls. Mirrors the v1 `invokeExtensionsAsync` call sites
 * in `app.ts` at lines 951 (init) and 956 (setup).
 *
 * Hook firing order: lexicographic by extension name (D10b).
 * Hooks may be async — all are awaited in sequence (not parallelised, same
 * contract as v1 `invokeExtensionsAsync`).
 *
 * Called by `app.ts` after `loadExtensions()` resolves. Never call before
 * extensions are loaded — `appExtensions[]` must be fully populated first.
 */
export async function invokeV2AppExtensions(
  hook: 'init' | 'setup'
): Promise<void> {
  const sorted = [...appExtensions].sort((a, b) => a.name.localeCompare(b.name))
  for (const ext of sorted) {
    const fn = ext[hook]
    if (!fn) continue
    try {
      await fn()
    } catch (err) {
      console.error(
        `[extension-api] Error in v2 extension "${ext.name}" ${hook}():`,
        err
      )
    }
  }
}
