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
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import {
  WidgetComponentContainer,
  WidgetComponentDisplay,
  WidgetComponentSchema,
  // WidgetComponentSerialize import removed per A16
  // (D-widget-serialization-simplification, wave-9) — adapter blocks gone.
  WidgetComponentValue
} from '@/world/widgets/widgetComponents'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'
import { defineComponentKey } from '@/world/componentKey'

import type {
  NodeHandle,
  NodeMode,
  SlotInfo,
  Point,
  Size
} from '@/extension-api/node'
import type { WidgetHandle, WidgetOptions } from '@/extension-api/widget'
import type { Unsubscribe } from '@/extension-api/events'
import { stampBrand } from '@/extension-api/brand'
import type {
  ExtensionOptions,
  NodeExtensionOptions,
  WidgetExtensionOptions
} from '@/extension-api/types'

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

// REMOVED per AXIOMS.md A15 (Widget Declarativity) and
// decisions/D-ban-runtime-addwidget.md — addDOMWidget on the v2 surface is
// gone, so the side table and getDOMWidgetElement accessor are dead.
// const domWidgetElements = new Map<WidgetEntityId, HTMLElement>()
// export function getDOMWidgetElement(widgetId): HTMLElement | undefined

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

function createWidgetHandle(widgetId: WidgetEntityId): WidgetHandle {
  const world = getWorld()

  // `on` is implemented as a single polymorphic function; cast satisfies the
  // typed overload signature in the WidgetHandle interface.
  return {
    // Per D20, public surface narrows the branded WidgetEntityId to string;
    // the runtime value is unchanged.
    id: widgetId as unknown as string,
    equals(other: WidgetHandle): boolean {
      return this.id === other.id
    },

    get name() {
      // TODO(#11939): TEMPORARY widget-name parse. Entity ID format is
      // "widget:graphId:nodeId:name", so the trailing segment after the last
      // ':' is the name. Replace with a dedicated WidgetNameComponent (or
      // reuse WidgetComponentSchema.name) once that lands. The `as unknown as
      // string` cast and the lastIndexOf(':') split should both go away then.
      // If the id has no ':' (defensive — should not happen with the canonical
      // format), fall back to the full id rather than an empty string.
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

    // PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
    // Authors cannot disable serialization at the widget level (A16).
    // Restoration requires axiom amendments to A15 + A16.
    //
    // isSerializeEnabled(): boolean { ... }
    // setSerializeEnabled(enabled: boolean): void { ... }

    // D-immutability-enforcement (Hybrid C): read-only snapshot of options
    // bag. Public type is Readonly<WidgetOptions> — TS-ERR on any assignment.
    // Mutate via setOption(key, value).
    get options() {
      const opts =
        world.getComponent(widgetId, WidgetComponentSchema)?.options ?? {}
      return opts as Readonly<WidgetOptions>
    },
    // D-immutability-enforcement (Hybrid C): accessor only — no setter. v2
    // migration target is on('beforeSerialize') per D5.
    get serializeValue() {
      const schema = world.getComponent(widgetId, WidgetComponentSchema)
      const fn = (schema?.options as Record<string, unknown> | undefined)?.[
        'serializeValue'
      ]
      return typeof fn === 'function'
        ? (fn as (...args: unknown[]) => unknown)
        : undefined
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
      } else if (event === 'optionChange') {
        // PHASE_A_EXCLUDED per AXIOMS.md A14 + A16 (D-widget-serialization-simplification, wave-9):
        // `propertyChange` event removed alongside `setSerializeEnabled`
        // (vacuous union after `'serialize'` was the sole member).
        // TODO(#11939): wire through ECS event bus when available
        if (import.meta.env.DEV) {
          console.warn(
            `[extension-api] widget.on("${event}") is not yet wired — Phase B`
          )
        }
        dispatch({ type: 'SubscribeWidgetEvent', widgetId, event, handler: fn })
        return () =>
          dispatch({
            type: 'UnsubscribeWidgetEvent',
            widgetId,
            event,
            handler: fn
          })
      } else if (event === 'beforeSerialize') {
        if (import.meta.env.DEV) {
          console.warn(
            '[extension-api] widget.on("beforeSerialize") is not yet wired — Phase B'
          )
        }
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

function createNodeHandle(nodeId: NodeEntityId): NodeHandle {
  const world = getWorld()

  return {
    // Per D20, public surface narrows the branded NodeEntityId to string;
    // the runtime value is unchanged.
    id: nodeId as unknown as string,
    equals(other: NodeHandle): boolean {
      return this.id === other.id
    },

    get type() {
      return world.getComponent(nodeId, NodeTypeKey)?.type ?? ''
    },
    get comfyClass() {
      return world.getComponent(nodeId, NodeTypeKey)?.comfyClass ?? ''
    },

    getPosition(): Point {
      // Position is centralized in layoutStore (Yjs CRDT-backed)
      // See D13 §4 — layoutStore.ts is the source of truth for position/size
      // D-immutability-enforcement: Point is a readonly tuple, so the literal
      // must be widened via `as const`.
      const layout = layoutStore.getNodeLayoutRef(nodeId).value
      return layout
        ? ([layout.position.x, layout.position.y] as const)
        : ([0, 0] as const)
    },
    getSize(): Size {
      // Size is centralized in layoutStore (Yjs CRDT-backed)
      // D-immutability-enforcement: Size is a readonly tuple, see getPosition.
      const layout = layoutStore.getNodeLayoutRef(nodeId).value
      return layout
        ? ([layout.size.width, layout.size.height] as const)
        : ([0, 0] as const)
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
      // Position writes go through layoutStore (Yjs CRDT-backed, operation-logged)
      // This provides undo/redo support via layoutStore's operation log
      const ref = layoutStore.getNodeLayoutRef(nodeId)
      if (ref.value) {
        ref.value = {
          ...ref.value,
          position: { x: pos[0], y: pos[1] },
          bounds: {
            ...ref.value.bounds,
            x: pos[0],
            y: pos[1]
          }
        }
      }
    },
    setSize(size: Size) {
      // Size writes go through layoutStore (Yjs CRDT-backed, operation-logged)
      const ref = layoutStore.getNodeLayoutRef(nodeId)
      if (ref.value) {
        ref.value = {
          ...ref.value,
          size: { width: size[0], height: size[1] },
          bounds: {
            ...ref.value.bounds,
            width: size[0],
            height: size[1]
          }
        }
      }
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
    getWidgets() {
      const container = world.getComponent(nodeId, WidgetComponentContainer)
      return (container?.widgetIds ?? []).map(createWidgetHandle)
    },
    // REMOVED per AXIOMS.md A15 (Widget Declarativity) and
    // decisions/D-ban-runtime-addwidget.md — widgets are schema-declared.
    // The v1 path remains @deprecated + runtime-warned on
    // LGraphNode.{addWidget,addCustomWidget} and addDOMWidget.
    // addWidget(...): WidgetHandle
    // addDOMWidget(opts): WidgetHandle

    getInputs() {
      const conn = world.getComponent(nodeId, ConnectivityKey)
      return (conn?.inputSlotIds ?? []).map((slotId: SlotEntityId) => {
        const slot = world.getComponent(
          slotId as unknown as WidgetEntityId,
          SlotIdentityKey
        )
        return {
          id: slotId as unknown as string,
          name: slot?.name ?? '',
          type: slot?.type ?? '',
          direction: 'input' as const,
          nodeId: nodeId as unknown as string,
          equals(other: SlotInfo): boolean {
            return this.id === other.id
          }
        } satisfies SlotInfo
      })
    },
    getOutputs() {
      const conn = world.getComponent(nodeId, ConnectivityKey)
      return (conn?.outputSlotIds ?? []).map((slotId: SlotEntityId) => {
        const slot = world.getComponent(
          slotId as unknown as WidgetEntityId,
          SlotIdentityKey
        )
        return {
          id: slotId as unknown as string,
          name: slot?.name ?? '',
          type: slot?.type ?? '',
          direction: 'output' as const,
          nodeId: nodeId as unknown as string,
          equals(other: SlotInfo): boolean {
            return this.id === other.id
          }
        } satisfies SlotInfo
      })
    },
    /** @deprecated D-immutability-enforcement: use getInputs(). */
    inputs() {
      return this.getInputs()
    },
    /** @deprecated D-immutability-enforcement: use getOutputs(). */
    outputs() {
      return this.getOutputs()
    },

    on: ((event: string, fn: (...args: unknown[]) => unknown): Unsubscribe => {
      if (event === 'positionChanged') {
        return watch(
          () => world.getComponent(nodeId, PositionKey)?.pos,
          (pos) => pos && fn({ pos })
        )
      } else if (event === 'sizeChanged') {
        return watch(
          () => world.getComponent(nodeId, DimensionsKey)?.size,
          (size) => size && fn({ size })
        )
      } else if (event === 'modeChanged') {
        return watch(
          () => world.getComponent(nodeId, ExecutionKey)?.mode,
          (mode) => mode !== undefined && fn({ mode })
        )
      } else if (
        event === 'executed' ||
        event === 'connected' ||
        event === 'disconnected' ||
        event === 'configured'
      ) {
        // TODO(#11939): replace with world.onSystemEvent once World interface gains it
        if (import.meta.env.DEV) {
          console.warn(
            `[extension-api] node.on('${event}') is a Phase-A stub — handlers will not fire until the dispatch substrate lands (#11939).`
          )
        }
        dispatch({ type: 'SubscribeNodeEvent', nodeId, event, handler: fn })
        return () =>
          dispatch({ type: 'UnsubscribeNodeEvent', nodeId, event, handler: fn })
      } else if (event === 'removed') {
        // onScopeDispose fires when the EffectScope for this extension+node is stopped,
        // which happens in unmountExtensionsForNode — exactly when the node is removed.
        onScopeDispose(() => fn())
        return () => {} // cleanup handled by scope.stop()
      } else if (event === 'beforeSerialize') {
        // DEPRECATED: Node-level serialization control — see ADR-0010.
        // Emit dev-mode warning, but still register the handler for backward compat.
        if (import.meta.env.DEV) {
          console.warn(
            `[extension-api] node.on('beforeSerialize') is deprecated and will be removed in v1.0. ` +
              `Use widget.on('beforeSerialize') instead — store extension state in widgets. ` +
              `See ADR-0010 for migration guidance.`
          )
        }
        dispatch({ type: 'RegisterNodeSerializer', nodeId, serializer: fn })
        return () =>
          dispatch({ type: 'UnregisterNodeSerializer', nodeId, serializer: fn })
      }
      if (import.meta.env.DEV) {
        console.warn(`[extension-api] Unknown node event: "${event}"`)
      }
      return () => {}
    }) as NodeHandle['on']
  }
}

// Mirrors Vue's currentInstance pattern. Set immediately before invoking
// nodeCreated/loadedGraphNode, cleared immediately after. Hook factories
// (onNodeMounted, onNodeRemoved) read this slot — must be called synchronously
// during setup or they throw in dev / no-op in prod.

let _currentScope: NodeInstanceScope | null = null

export function getCurrentScope(): NodeInstanceScope | null {
  return _currentScope
}

// ─────────────────────────────────────────────────────────────────────────────
// D-bootstrap-hooks (W6.P6.C) — extension/sidebar/panel lifecycle context
// ─────────────────────────────────────────────────────────────────────────────
//
// SD-1 + SD-2 (handoff-11): we ship a tagged-union lifecycle context for the
// new context-scoped hooks (`onMounted` / `onBeforeMount` / `onUnmounted` /
// `onActivated` / `onDeactivated`). Vue's `currentInstance` precedent argues
// for a single slot across all instance kinds; the existing `_currentScope`
// is preserved as-is for node hooks to keep the shipped tests passing — the
// node kind lives in its own slot for blast-radius reasons, and the new
// extension/sidebar/panel kinds share a single new slot below. Full slot
// consolidation (single `_currentInstance` covering all kinds) is a
// follow-up; the public hook surface is identical either way.

/**
 * Lifecycle context for a `defineExtension` / `defineSidebarTab` /
 * `defineBottomPanelTab` setup body. The runtime sets `_currentExtensionInstance`
 * to one of these immediately before invoking the user's `setup()`, then
 * restores the previous value. Hook factories (`onMounted`, etc) read this
 * slot to capture callbacks into the right context.
 *
 * @internal
 */
export interface ExtensionLifecycleContext {
  readonly kind: 'extension' | 'sidebarTab' | 'bottomPanel'
  readonly name: string
  readonly beforeMountHooks: Array<() => void>
  readonly mountHooks: Array<() => void>
  readonly unmountHooks: Array<() => void>
  readonly activateHooks: Array<() => void>
  readonly deactivateHooks: Array<() => void>
}

let _currentExtensionInstance: ExtensionLifecycleContext | null = null

/** @internal */
export function getCurrentExtensionInstance(): ExtensionLifecycleContext | null {
  return _currentExtensionInstance
}

function createExtensionContext(
  kind: ExtensionLifecycleContext['kind'],
  name: string
): ExtensionLifecycleContext {
  return {
    kind,
    name,
    beforeMountHooks: [],
    mountHooks: [],
    unmountHooks: [],
    activateHooks: [],
    deactivateHooks: []
  }
}

function outsideContextError(hook: string): string {
  return (
    `[extension-api] ${hook}() called outside a setup context. ` +
    `Call it synchronously inside the setup() body of defineExtension, ` +
    `defineSidebarTab, or defineBottomPanelTab (D-bootstrap-hooks).`
  )
}

/**
 * Register a callback to fire when the surrounding instance is mounted.
 *
 * - Inside `defineExtension.setup`: fires after the app is fully mounted.
 * - Inside `defineSidebarTab.setup`: fires when the tab's DOM is created.
 * - Inside `defineBottomPanelTab.setup`: fires when the panel's DOM is created.
 *
 * Must be called synchronously inside the surrounding `setup()` body. Calling
 * after an `await` (or outside any setup context) throws in development and
 * silently no-ops in production.
 *
 * @publicAPI
 * @stability experimental
 */
export function onMounted(fn: () => void): void {
  if (!_currentExtensionInstance) {
    if (import.meta.env.DEV) throw new Error(outsideContextError('onMounted'))
    return
  }
  _currentExtensionInstance.mountHooks.push(fn)
}

/**
 * Register a callback to fire just before the surrounding instance is mounted.
 *
 * Symmetry partner of {@link onMounted}. Rarely needed — most use cases want
 * `onMounted`. Use this when you need to schedule pre-mount work (e.g.
 * preparing a reactive sentinel) that the mount-time code depends on.
 *
 * Must be called synchronously inside a `setup()` body.
 *
 * @publicAPI
 * @stability experimental
 */
export function onBeforeMount(fn: () => void): void {
  if (!_currentExtensionInstance) {
    if (import.meta.env.DEV)
      throw new Error(outsideContextError('onBeforeMount'))
    return
  }
  _currentExtensionInstance.beforeMountHooks.push(fn)
}

/**
 * Register a callback to fire when the surrounding instance is unmounted.
 *
 * - Inside `defineExtension.setup`: fires at app teardown (rare).
 * - Inside `defineSidebarTab.setup`: fires when the tab is removed.
 * - Inside `defineBottomPanelTab.setup`: fires when the panel is removed.
 *
 * Use for cleanup: close connections, abort fetches, release resources.
 *
 * Must be called synchronously inside a `setup()` body.
 *
 * @publicAPI
 * @stability experimental
 */
export function onUnmounted(fn: () => void): void {
  if (!_currentExtensionInstance) {
    if (import.meta.env.DEV) throw new Error(outsideContextError('onUnmounted'))
    return
  }
  _currentExtensionInstance.unmountHooks.push(fn)
}

/**
 * Register a callback to fire when the surrounding tab/panel is shown.
 *
 * Only valid inside `defineSidebarTab.setup` or `defineBottomPanelTab.setup` —
 * the lifecycle has no "shown" semantic for app-level `defineExtension`. Throws
 * in dev / no-ops in prod when called inside `defineExtension.setup`.
 *
 * Must be called synchronously inside a `setup()` body.
 *
 * @publicAPI
 * @stability experimental
 */
export function onActivated(fn: () => void): void {
  if (!_currentExtensionInstance) {
    if (import.meta.env.DEV) throw new Error(outsideContextError('onActivated'))
    return
  }
  if (_currentExtensionInstance.kind === 'extension') {
    if (import.meta.env.DEV) {
      throw new Error(
        '[extension-api] onActivated() is not valid inside defineExtension.setup — ' +
          'use inside defineSidebarTab.setup or defineBottomPanelTab.setup instead.'
      )
    }
    return
  }
  _currentExtensionInstance.activateHooks.push(fn)
}

/**
 * Register a callback to fire when the surrounding tab/panel is hidden.
 *
 * Symmetry partner of {@link onActivated}. Same kind restrictions apply.
 *
 * Must be called synchronously inside a `setup()` body.
 *
 * @publicAPI
 * @stability experimental
 */
export function onDeactivated(fn: () => void): void {
  if (!_currentExtensionInstance) {
    if (import.meta.env.DEV)
      throw new Error(outsideContextError('onDeactivated'))
    return
  }
  if (_currentExtensionInstance.kind === 'extension') {
    if (import.meta.env.DEV) {
      throw new Error(
        '[extension-api] onDeactivated() is not valid inside defineExtension.setup — ' +
          'use inside defineSidebarTab.setup or defineBottomPanelTab.setup instead.'
      )
    }
    return
  }
  _currentExtensionInstance.deactivateHooks.push(fn)
}

/**
 * Run `body` with `_currentExtensionInstance` set to `ctx`. Restores the
 * previous value on completion (including on throw). Mirrors Vue's
 * `setCurrentInstance` / `unsetCurrentInstance` bracketing.
 *
 * @internal
 */
function withExtensionInstance<T>(
  ctx: ExtensionLifecycleContext,
  body: () => T
): T {
  const prev = _currentExtensionInstance
  _currentExtensionInstance = ctx
  try {
    return body()
  } finally {
    _currentExtensionInstance = prev
  }
}

/** Registry of extension-level contexts keyed by extension name. */
const extensionContextRegistry = new Map<string, ExtensionLifecycleContext>()

/** @internal Test-only: clear extension-level lifecycle contexts. */
export function _clearExtensionContextsForTesting(): void {
  extensionContextRegistry.clear()
  _currentExtensionInstance = null
}

/** @internal Read-only view of registered extension contexts. */
export function getExtensionContextRegistry(): ReadonlyMap<
  string,
  Readonly<ExtensionLifecycleContext>
> {
  return extensionContextRegistry
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

const appExtensions: ExtensionOptions[] = []
const nodeExtensions: NodeExtensionOptions[] = []
const widgetExtensions: WidgetExtensionOptions[] = []

// Dev-mode warning: detect if extensions are registered but system never starts.
// Uses a one-shot timer scheduled on first registration (ADR-0012 mitigation).
let _startupCheckScheduled = false

function scheduleStartupCheck(): void {
  if (_startupCheckScheduled || !import.meta.env.DEV) return
  _startupCheckScheduled = true

  // Check after 5 seconds — bootstrap should have called startExtensionSystem by then.
  setTimeout(() => {
    const hasExtensions =
      nodeExtensions.length > 0 ||
      widgetExtensions.length > 0 ||
      appExtensions.length > 0
    if (hasExtensions && !_extensionSystemStarted) {
      console.warn(
        `[extension-api] Extensions were registered via defineNode/defineWidget/defineExtension ` +
          `but startExtensionSystem() was never called. Extensions will not be mounted. ` +
          `Call startExtensionSystem() during app bootstrap.`
      )
    }
  }, 5000)
}

// D18 Phase 1: stamp brand on all define* returns so a future loader can
// recognise them via `isBrandedExtension(...)`. Side-effect registration
// remains in place for Phase 1; Phase 2 will remove the push() calls and
// move registration into the loader (per decisions/D18-pure-functions-loader-registration.md).
export function defineExtension(options: ExtensionOptions): ExtensionOptions {
  appExtensions.push(options)
  scheduleStartupCheck()
  return stampBrand(options, 'app')
}

export function defineNode(
  options: NodeExtensionOptions
): NodeExtensionOptions {
  nodeExtensions.push(options)
  scheduleStartupCheck()
  return stampBrand(options, 'node')
}

export function defineWidget(
  options: WidgetExtensionOptions
): WidgetExtensionOptions {
  widgetExtensions.push(options)
  scheduleStartupCheck()
  return stampBrand(options, 'widget')
}

/** @internal Test-only: clear all registered extensions and reset state. */
export function _clearExtensionsForTesting(): void {
  nodeExtensions.length = 0
  appExtensions.length = 0
  widgetExtensions.length = 0
  _extensionSystemStarted = false
  _startupCheckScheduled = false
}

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

// Watches the World for entity creation/removal via world.entitiesWith().
// The World's component buckets are reactive(Map), so this watch fires
// whenever NodeType entities are added or removed — no imperative dispatch
// needed. See scope-registry-spike.md §3 and decisions/D3.5.
// TODO(D8): World reactivity is not yet wired — this watch won't fire in
// Phase A. The design for reactive World (D8) is still unresolved.

let _extensionSystemStarted = false

/**
 * Boots the extension system's reactive mount watcher.
 *
 * @internal Not part of the public extension author API. Called by app.ts
 * during initialization. Do not export from the public barrel.
 */
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

  // D-shell-ui-entrypoints (W6.P5.C) — flush any defineSidebarTab /
  // defineCommand / defineHotkey / … calls that were made at module-eval
  // time (before Pinia was ready). Subsequent calls mount eagerly via the
  // _systemStarted flag inside registrations.ts.
  void import('@/extension-api/registrations').then(
    ({ _flushShellRegistrations }) => {
      _flushShellRegistrations()
    }
  )

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
 * Invoke app-level v2 extension hooks for all registered `defineExtension()`
 * calls. Mirrors the v1 `invokeExtensionsAsync` call sites in `app.ts` at
 * lines 951 (init) and 956 (setup).
 *
 * Hook firing order: lexicographic by extension name (D10b).
 * Hooks may be async — all are awaited in sequence (not parallelised, same
 * contract as v1 `invokeExtensionsAsync`).
 *
 * Called by `app.ts` after `loadExtensions()` resolves. Never call before
 * extensions are loaded — `appExtensions[]` must be fully populated first.
 *
 * ## D-bootstrap-hooks integration (W6.P6.C)
 *
 * When invoked with `'setup'`:
 *
 * 1. For each extension, the runtime sets `_currentExtensionInstance` to
 *    the extension's `ExtensionLifecycleContext` and invokes the deprecated
 *    `options.setup()` body inside that context. Any synchronous
 *    `onBeforeMount` / `onMounted` / `onUnmounted` calls inside the body
 *    are captured into the context's hook arrays.
 * 2. After ALL `setup()` invocations complete, the runtime flushes
 *    `beforeMountHooks` then `mountHooks` for each extension (in registration
 *    order with lexicographic tie-break per D10b). This implements the
 *    "app is mounted" lifecycle event for `onMounted` callbacks.
 *
 * `onUnmounted` callbacks are flushed by {@link teardownV2AppExtensions}.
 *
 * `init` hooks are invoked unchanged (no lifecycle-context wrapping) — they
 * predate the bootstrap-hooks shape and are marked `@deprecated` in v2; the
 * migration mapper says "move `init` body into `setup` body" so post-codemod
 * the `init` path is empty.
 */
export async function invokeV2AppExtensions(
  hook: 'init' | 'setup'
): Promise<void> {
  const sorted = [...appExtensions].sort((a, b) => a.name.localeCompare(b.name))

  // Phase 1: invoke the hook body inside the lifecycle context (setup) or
  // bare (init).
  for (const ext of sorted) {
    const fn = ext[hook]
    if (!fn) continue
    try {
      if (hook === 'setup') {
        const ctx =
          extensionContextRegistry.get(ext.name) ??
          createExtensionContext('extension', ext.name)
        extensionContextRegistry.set(ext.name, ctx)
        // setup() body may be async — invoke first, then bracket the
        // synchronous portion via withExtensionInstance. Authors that need
        // to register hooks after an await must use the dispose pattern, not
        // re-enter onMounted (mirrors Vue's onMounted constraint).
        await withExtensionInstance(ctx, () => fn())
      } else {
        await fn()
      }
    } catch (err) {
      console.error(
        `[extension-api] Error in v2 extension "${ext.name}" ${hook}():`,
        err
      )
    }
  }

  // Phase 2 (setup only): flush onBeforeMount → onMounted across all
  // extensions. This is the "app is mounted" lifecycle event.
  if (hook === 'setup') {
    for (const ext of sorted) {
      const ctx = extensionContextRegistry.get(ext.name)
      if (!ctx) continue
      for (const fn of ctx.beforeMountHooks) {
        try {
          fn()
        } catch (err) {
          console.error(
            `[extension-api] Error in onBeforeMount() for "${ext.name}":`,
            err
          )
        }
      }
      // beforeMountHooks fire once — drain so re-mount (rare; e.g. HMR) is clean.
      ctx.beforeMountHooks.length = 0
    }
    for (const ext of sorted) {
      const ctx = extensionContextRegistry.get(ext.name)
      if (!ctx) continue
      for (const fn of ctx.mountHooks) {
        try {
          fn()
        } catch (err) {
          console.error(
            `[extension-api] Error in onMounted() for "${ext.name}":`,
            err
          )
        }
      }
      ctx.mountHooks.length = 0
    }
  }
}

/**
 * Flush `onUnmounted` callbacks for all registered v2 extensions. Called by
 * `app.ts` during app teardown (rare — most extensions live for the app's
 * full lifetime).
 *
 * @internal
 */
export function teardownV2AppExtensions(): void {
  const sorted = [...appExtensions].sort((a, b) => a.name.localeCompare(b.name))
  for (const ext of sorted) {
    const ctx = extensionContextRegistry.get(ext.name)
    if (!ctx) continue
    for (const fn of ctx.unmountHooks) {
      try {
        fn()
      } catch (err) {
        console.error(
          `[extension-api] Error in onUnmounted() for "${ext.name}":`,
          err
        )
      }
    }
    ctx.unmountHooks.length = 0
  }
}
