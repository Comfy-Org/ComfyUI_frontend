import { defineStore } from 'pinia'
import { getCurrentScope, onScopeDispose, reactive, ref } from 'vue'
import * as Y from 'yjs'

import {
  isRemoteUpdateOrigin,
  ownerNodesMap,
  semanticDocs
} from '@/stores/semanticDoc'
import type { LocalUpdateOrigin } from '@/stores/semanticDoc'
import { toOwningGraphId } from '@/types/graphScopeId'
import type { OwningGraphId, RootGraphId } from '@/types/graphScopeId'
import type { UUID } from '@/utils/uuid'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import {
  isWidgetId,
  parseWidgetId,
  widgetId as createWidgetId
} from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetState, WidgetStateInit } from '@/types/widgetState'
import {
  applyLegacyHiddenWrite,
  deriveWidgetVisibility,
  setWidgetAdvanced,
  setWidgetHiddenInPanel
} from '@/types/widgetVisibility'
import type { WidgetVisibilityComponent } from '@/types/widgetVisibility'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'

export interface WidgetRenderState {
  hasLayoutSize?: boolean
  isDOMWidget?: boolean
  tooltip?: string
}

interface WidgetRestorationState {
  positional: readonly WidgetValue[]
  named?: Readonly<Record<string, WidgetValue>>
  restoreNamed: boolean
}

interface WidgetEntity {
  state: WidgetState
  render: WidgetRenderState
  visibility: WidgetVisibilityComponent
}

interface WidgetValueChange {
  widgetId: WidgetId
  value: WidgetValue
  oldValue: WidgetValue
  context?: RemoteMutationContext
}

function setNodeScoped<T>(
  graphMap: Map<UUID, Map<NodeId, T>>,
  graphId: UUID,
  nodeId: NodeId,
  value: T
): void {
  let nodeMap = graphMap.get(graphId)
  if (!nodeMap) {
    nodeMap = new Map()
    graphMap.set(graphId, nodeMap)
  }
  nodeMap.set(nodeId, value)
}

function clearNodeScoped<T>(
  graphMap: Map<UUID, Map<NodeId, T>>,
  graphId: UUID,
  nodeId: NodeId
): void {
  const nodeMap = graphMap.get(graphId)
  if (!nodeMap) return
  nodeMap.delete(nodeId)
  if (nodeMap.size === 0) graphMap.delete(graphId)
}

export function stripGraphPrefix(scopedId: SerializedNodeId): NodeId | null {
  return parseNodeId(String(scopedId).replace(/^(.*:)+/, ''))
}

const WIDGETS_KEY = 'widgets'

function localOrigin(context?: RemoteMutationContext): LocalUpdateOrigin {
  return context
    ? { source: 'local', actor: context.actor, opId: context.opId }
    : { source: 'local' }
}

/**
 * Writes one widget value through to the semantic Yjs document at
 * `nodes.<nodeId>.widgets.<name>` (root owner) or
 * `definitions.<owner>.nodes.<nodeId>.widgets.<name>`, as one local
 * transaction carrying `context`'s provenance. The store keys widgets by the
 * owning graph alone, so the root is resolved with
 * {@link SemanticDocRegistry.rootFor}; a graph with no document, or a node
 * `nodeDataStore` has not projected yet, is left untouched - node membership
 * is that store's write, this one only follows values.
 */
function projectValue(
  graphId: UUID,
  nodeId: NodeId,
  name: string,
  value: WidgetValue,
  context?: RemoteMutationContext
): void {
  const owningGraphId = toOwningGraphId(graphId)
  const rootGraphId = semanticDocs.rootFor(owningGraphId)
  if (!rootGraphId) return
  semanticDocs.transactLocal(rootGraphId, localOrigin(context), (doc) => {
    const node = ownerNodesMap(doc, rootGraphId, owningGraphId, false)?.get(
      nodeId
    )
    if (!(node instanceof Y.Map)) return
    let widgets = node.get(WIDGETS_KEY)
    if (widgets === undefined) {
      widgets = new Y.Map<unknown>()
      node.set(WIDGETS_KEY, widgets)
    }
    // A non-map `widgets` is a malformed node another writer owns; never
    // clobber it from here.
    if (!(widgets instanceof Y.Map)) return
    if (widgets.has(name) && Object.is(widgets.get(name), value)) return
    widgets.set(name, value)
  })
}

/** A widget value a remote-origin transaction changed, located by owner. */
interface RemoteWidgetValue {
  owningGraphId: OwningGraphId
  nodeId: NodeId
  name: string
  value: WidgetValue
}

function widgetsMapOf(node: unknown): Y.Map<unknown> | undefined {
  if (!(node instanceof Y.Map)) return undefined
  const widgets = node.get(WIDGETS_KEY)
  return widgets instanceof Y.Map ? widgets : undefined
}

/**
 * Collects every widget value a remote-origin transaction may have changed
 * under `rootGraphId`, from the deep events on the `nodes` root and the
 * `definitions` root. The events name the touched node (or, for a
 * definition-level change, the touched owner); the values are then read back
 * from the document so a node or `widgets` map set wholesale is covered the
 * same way as a single key. Deleted nodes yield nothing: membership removal
 * belongs to `nodeDataStore`, which releases the widgets.
 */
function collectRemoteWidgetValues(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  events: readonly Y.YEvent<Y.AbstractType<unknown>>[]
): RemoteWidgetValue[] {
  const rootOwner = toOwningGraphId(rootGraphId)
  const rootNodes = ownerNodesMap(doc, rootGraphId, rootOwner, false)
  const nodesByOwner = collectTouchedNodes(events, rootNodes, rootOwner)
  return readTouchedWidgetValues(doc, rootGraphId, nodesByOwner)
}

type TouchedNodesByOwner = Map<OwningGraphId, Set<NodeId> | 'all'>

/**
 * Classifies deep events into the nodes whose widgets must be read back:
 * a specific node set per owner, or `'all'` when an owner's `nodes` map (or
 * the owner itself) was replaced wholesale.
 */
function collectTouchedNodes(
  events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
  rootNodes: Y.Map<unknown> | undefined,
  rootOwner: OwningGraphId
): TouchedNodesByOwner {
  const nodesByOwner: TouchedNodesByOwner = new Map()

  const touchNode = (owningGraphId: OwningGraphId, nodeId: NodeId) => {
    const nodes = nodesByOwner.get(owningGraphId)
    if (nodes === 'all') return
    if (nodes) nodes.add(nodeId)
    else nodesByOwner.set(owningGraphId, new Set([nodeId]))
  }
  const touchOwner = (owningGraphId: OwningGraphId) =>
    nodesByOwner.set(owningGraphId, 'all')
  const touchKeys = (
    event: Y.YEvent<Y.AbstractType<unknown>>,
    touch: (key: string) => void
  ) => {
    for (const [key, change] of event.changes.keys) {
      if (change.action !== 'delete') touch(key)
    }
  }

  for (const event of events) {
    const path = event.path.map(String)
    if (event.currentTarget === rootNodes) {
      if (path.length === 0)
        touchKeys(event, (key) => touchNode(rootOwner, key as NodeId))
      else touchNode(rootOwner, path[0] as NodeId)
      continue
    }
    // Anything else is the `definitions` root: definitions.<owner>.nodes.<id>
    if (path.length === 0) {
      touchKeys(event, (key) => touchOwner(toOwningGraphId(key)))
      continue
    }
    const owningGraphId = toOwningGraphId(path[0])
    if (path.length === 1) {
      touchKeys(event, (key) => {
        if (key === 'nodes') touchOwner(owningGraphId)
      })
      continue
    }
    if (path[1] !== 'nodes') continue
    if (path.length === 2)
      touchKeys(event, (key) => touchNode(owningGraphId, key as NodeId))
    else touchNode(owningGraphId, path[2] as NodeId)
  }
  return nodesByOwner
}

/** Reads the current widget values of every touched node from the document. */
function readTouchedWidgetValues(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  nodesByOwner: TouchedNodesByOwner
): RemoteWidgetValue[] {
  const values: RemoteWidgetValue[] = []
  const readNode = (owningGraphId: OwningGraphId, nodeId: NodeId) => {
    const owned = ownerNodesMap(doc, rootGraphId, owningGraphId, false)
    const widgets = widgetsMapOf(owned?.get(nodeId))
    if (!widgets) return
    for (const [name, value] of widgets) {
      if (value instanceof Y.AbstractType) continue
      values.push({ owningGraphId, nodeId, name, value: value as WidgetValue })
    }
  }
  for (const [owningGraphId, nodes] of nodesByOwner) {
    if (nodes !== 'all') {
      for (const nodeId of nodes) readNode(owningGraphId, nodeId)
      continue
    }
    const owned = ownerNodesMap(doc, rootGraphId, owningGraphId, false)
    if (!owned) continue
    for (const nodeId of owned.keys()) readNode(owningGraphId, nodeId as NodeId)
  }
  return values
}

/**
 * Live re-registration of an existing widget of the same type: refresh the
 * definition, render and visibility state in place while keeping its value.
 */
function refreshRegisteredWidget(
  existing: WidgetEntity,
  init: WidgetStateInit,
  next: {
    nodeId: NodeId
    storageName: string
    renderState: WidgetRenderState
    visibility: WidgetVisibilityComponent
  }
): void {
  Object.assign(existing.state, init, {
    name: init.name ?? next.storageName,
    nodeId: next.nodeId,
    value: existing.state.value,
    y: init.y ?? existing.state.y
  })
  Object.assign(existing.render, next.renderState)
  Object.assign(existing.visibility.surfaces, next.visibility.surfaces)
  existing.visibility.suppression.byExtension =
    next.visibility.suppression.byExtension
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const graphWidgets = ref(new Map<UUID, Map<WidgetId, WidgetEntity>>())
  const graphNodeWidgetOrders = ref(new Map<UUID, Map<NodeId, WidgetId[]>>())
  const graphWidgetRestorations = new Map<
    UUID,
    Map<NodeId, WidgetRestorationState>
  >()

  const valueChangeListeners = new Set<(change: WidgetValueChange) => void>()
  const valueMutationContexts = new WeakMap<
    WidgetState,
    RemoteMutationContext
  >()

  /**
   * Widgets whose value last changed without a `RemoteMutationContext` -
   * a human edit, or any other write that bypassed `setValue`'s context
   * param. A CRDT catch-up reconcile reads its doc snapshot on its own
   * schedule and must not replay a value over one of these: the snapshot
   * predates the edit by definition, and clobbering it silently discards
   * work in progress (PM-1303/PM-1310 "hypothesis C"). `setValue` clears an
   * id once its own context-carrying write lands, whether or not that write
   * changes the value.
   */
  const locallyDirtyWidgets = new Set<WidgetId>()

  /**
   * Depth counter for {@link withLocalDirtyTrackingSuppressed} and the
   * {@link beginLocalDirtyTrackingSuppression}/
   * {@link endLocalDirtyTrackingSuppression} pair. A context-less write made
   * while this is above zero is a structural replay - e.g.
   * `agentNodeMaterializer`'s `node.configure()` catch-up (which legitimately
   * re-applies a stale positional snapshot before immediately correcting it),
   * or any workflow load's `LGraphNode.configure()` re-applying a tab's own
   * locally-saved (possibly pre-edit) snapshot onto widgets already aliased
   * to newer canonical state - rather than a human edit, so it must not arm
   * the one-shot stale-reconcile guard.
   */
  let dirtyTrackingSuppressed = 0

  /**
   * Depth of {@link applyRemoteValues} on the stack; while positive, the
   * `observeValue` setter skips the semantic-document write-through.
   */
  let applyingRemoteValue = 0

  function observeValue<TValue extends WidgetValue>(
    state: WidgetState<TValue>,
    graphId: UUID
  ): void {
    let value = state.value
    Object.defineProperty(state, 'value', {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (nextValue: TValue) => {
        if (Object.is(value, nextValue)) return
        const oldValue = value
        value = nextValue
        const widgetId = createWidgetId(graphId, state.nodeId, state.name)
        if (getWidget(widgetId) !== state) return
        const context = valueMutationContexts.get(state)
        valueMutationContexts.delete(state)
        if (!context && dirtyTrackingSuppressed === 0) {
          locallyDirtyWidgets.add(widgetId)
        }
        // A value arriving from the document must not be echoed back into it
        // (KA-6: no outbound write from a remote-origin observer).
        if (applyingRemoteValue === 0) {
          observeRemoteValues(graphId)
          projectValue(graphId, state.nodeId, state.name, value, context)
        }
        for (const listener of valueChangeListeners) {
          listener({ widgetId, value, oldValue, context })
        }
      }
    })
  }

  /**
   * Read side of the projection: applies widget values a remote-origin
   * transaction changed to the registered widget state. Runs with local-dirty
   * tracking suppressed and without provenance, like a structural replay: the
   * document is the source of truth, so the value is never a local edit.
   * Widgets that are not registered (yet) are skipped; `registerWidget`'s
   * write-through then reconciles against the document value.
   */
  function applyRemoteValues(values: readonly RemoteWidgetValue[]): void {
    if (values.length === 0) return
    applyingRemoteValue++
    try {
      withLocalDirtyTrackingSuppressed(() => {
        for (const { owningGraphId, nodeId, name, value } of values) {
          const graphId = owningGraphId as string as UUID
          const widgetId = createWidgetId(graphId, nodeId, name)
          const state = graphWidgets.value.get(graphId)?.get(widgetId)?.state
          if (!state || Object.is(state.value, value)) continue
          locallyDirtyWidgets.delete(widgetId)
          state.value = value
        }
      })
    } finally {
      applyingRemoteValue--
    }
  }

  /**
   * Remote-origin observers by root graph, keyed with the document they were
   * attached to so a destroyed-and-recreated document is re-observed. Only
   * transactions with a remote update origin (`isRemoteUpdateOrigin`) apply:
   * local writes already went through `projectValue` from the setter.
   */
  const remoteObservers = new Map<
    RootGraphId,
    { doc: Y.Doc; unobserve: () => void }
  >()

  function observeRemoteValues(graphId: UUID): void {
    const rootGraphId = semanticDocs.rootFor(toOwningGraphId(graphId))
    if (!rootGraphId) return
    const doc = semanticDocs.get(rootGraphId)
    if (!doc) return
    const existing = remoteObservers.get(rootGraphId)
    if (existing?.doc === doc) return
    existing?.unobserve()
    const unobserve = semanticDocs.observeNodes(
      rootGraphId,
      (events, transaction) => {
        if (!isRemoteUpdateOrigin(transaction.origin)) return
        applyRemoteValues(collectRemoteWidgetValues(doc, rootGraphId, events))
      }
    )
    remoteObservers.set(rootGraphId, { doc, unobserve })
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const { unobserve } of remoteObservers.values()) unobserve()
      remoteObservers.clear()
    })
  }

  /**
   * Runs `fn` with local-dirty tracking suppressed: every context-less write
   * inside it is treated as a structural adapter replay, never as a human
   * edit that needs {@link isLocallyDirty} protection. Reentrant-safe.
   */
  function withLocalDirtyTrackingSuppressed<T>(fn: () => T): T {
    beginLocalDirtyTrackingSuppression()
    try {
      return fn()
    } finally {
      endLocalDirtyTrackingSuppression()
    }
  }

  /**
   * Opens a local-dirty-tracking-suppressed window without a matching
   * synchronous callback, for a caller that must pair with
   * {@link endLocalDirtyTrackingSuppression} across an async boundary (e.g.
   * an extension's `beforeLoadGraph`/`afterConfigureGraph` hooks around a
   * workflow load). Reentrant: nests with any other suppression in effect.
   */
  function beginLocalDirtyTrackingSuppression(): void {
    dirtyTrackingSuppressed++
  }

  /** Closes one suppression opened by {@link beginLocalDirtyTrackingSuppression}. */
  function endLocalDirtyTrackingSuppression(): void {
    dirtyTrackingSuppressed = Math.max(0, dirtyTrackingSuppressed - 1)
  }

  function onValueChange(
    listener: (change: WidgetValueChange) => void
  ): () => void {
    valueChangeListeners.add(listener)
    return () => valueChangeListeners.delete(listener)
  }

  function setNodeWidgetRestoration(
    graphId: UUID,
    nodeId: NodeId,
    restoration: WidgetRestorationState
  ): void {
    setNodeScoped(graphWidgetRestorations, graphId, nodeId, restoration)
  }

  function getRestoredWidgetValue(
    graphId: UUID,
    nodeId: NodeId,
    name: string,
    positionalIndex: number
  ): { value: WidgetValue } | undefined {
    const restoration = graphWidgetRestorations.get(graphId)?.get(nodeId)
    if (!restoration) return
    if (restoration.restoreNamed && restoration.named) {
      return Object.hasOwn(restoration.named, name)
        ? { value: restoration.named[name] }
        : undefined
    }
    return positionalIndex < restoration.positional.length
      ? { value: restoration.positional[positionalIndex] }
      : undefined
  }

  function clearNodeWidgetRestoration(graphId: UUID, nodeId: NodeId): void {
    clearNodeScoped(graphWidgetRestorations, graphId, nodeId)
  }

  function getGraphWidgets(graphId: UUID): Map<WidgetId, WidgetEntity> {
    const widgets = graphWidgets.value.get(graphId)
    if (widgets) return widgets

    const nextWidgets = reactive(new Map<WidgetId, WidgetEntity>())
    graphWidgets.value.set(graphId, nextWidgets)
    return nextWidgets
  }

  function findGraphWidgets(
    graphId: UUID
  ): Map<WidgetId, WidgetEntity> | undefined {
    return graphWidgets.value.get(graphId)
  }

  function getGraphNodeWidgetOrders(graphId: UUID): Map<NodeId, WidgetId[]> {
    const widgetOrders = graphNodeWidgetOrders.value.get(graphId)
    if (widgetOrders) return widgetOrders

    const nextWidgetOrders = reactive(new Map<NodeId, WidgetId[]>())
    graphNodeWidgetOrders.value.set(graphId, nextWidgetOrders)
    return nextWidgetOrders
  }

  function getNodeWidgetOrder(graphId: UUID, nodeId: NodeId): WidgetId[] {
    const graphOrders = getGraphNodeWidgetOrders(graphId)
    const order = graphOrders.get(nodeId)
    if (order) return order

    const nextOrder = reactive<WidgetId[]>([])
    graphOrders.set(nodeId, nextOrder)
    return nextOrder
  }

  function appendNodeWidgetOrder(widgetId: WidgetId): void {
    const { graphId, nodeId } = parseWidgetId(widgetId)
    const order = getNodeWidgetOrder(graphId, nodeId)
    if (!order.includes(widgetId)) order.push(widgetId)
  }

  function removeNodeWidgetOrder(widgetId: WidgetId): void {
    const { graphId, nodeId } = parseWidgetId(widgetId)
    const graphOrders = graphNodeWidgetOrders.value.get(graphId)
    if (!graphOrders) return
    const order = graphOrders.get(nodeId)
    if (!order) return

    const index = order.indexOf(widgetId)
    if (index !== -1) order.splice(index, 1)
    if (order.length === 0) graphOrders.delete(nodeId)
  }

  /**
   * @returns The existing state for the same widget type, replacement state
   * for a different type, or `undefined` for an invalid widget ID.
   */
  function registerWidget<
    TValue extends WidgetValue = WidgetValue,
    TType extends string = string,
    TOptions extends IWidgetOptions = IWidgetOptions
  >(
    widgetId: WidgetId,
    init: WidgetStateInit<TValue, TType, TOptions>,
    renderState?: WidgetRenderState,
    visibility?: WidgetVisibilityComponent,
    context?: RemoteMutationContext
  ): WidgetState<TValue, TType, TOptions> | undefined
  function registerWidget(
    widgetId: WidgetId,
    init: WidgetStateInit,
    renderState: WidgetRenderState = {},
    visibility: WidgetVisibilityComponent = deriveWidgetVisibility({
      type: init.type,
      options: init.options
    }),
    context?: RemoteMutationContext
  ): WidgetState | undefined {
    if (!isWidgetId(widgetId)) {
      console.warn(
        'widgetValueStore.registerWidget: ignoring un-keyable widget id',
        widgetId
      )
      return undefined
    }

    const { graphId, nodeId, name: storageName } = parseWidgetId(widgetId)
    const widgets = getGraphWidgets(graphId)
    const existing = widgets.get(widgetId)
    // WidgetId is `graphId:nodeId:name`. A node replacement can reuse the same
    // numeric nodeId, so a stale entry from the previous occupant may survive in
    // the store under the same key. The type check distinguishes a live
    // re-registration (same widget, keep its value) from a recycled key (new
    // widget type at an old address, overwrite). Without it a text widget
    // rendered as the prior int type until the next full reload (#13073, #13773).
    if (existing && existing.state.type === init.type) {
      refreshRegisteredWidget(existing, init, {
        nodeId,
        storageName,
        renderState,
        visibility
      })
      appendNodeWidgetOrder(widgetId)
      return existing.state
    }

    const state: WidgetState = {
      ...init,
      nodeId,
      name: init.name ?? storageName,
      y: init.y ?? 0
    }
    widgets.set(widgetId, {
      state,
      render: { ...renderState },
      visibility: {
        surfaces: { ...visibility.surfaces },
        suppression: { ...visibility.suppression }
      }
    })
    appendNodeWidgetOrder(widgetId)
    const registered = widgets.get(widgetId)?.state
    if (registered) {
      observeValue(registered, graphId)
      observeRemoteValues(graphId)
      projectValue(graphId, nodeId, registered.name, registered.value, context)
    }
    return registered
  }

  function getWidget(widgetId: WidgetId): WidgetState | undefined {
    if (!isWidgetId(widgetId)) return undefined

    const { graphId } = parseWidgetId(widgetId)
    return graphWidgets.value.get(graphId)?.get(widgetId)?.state
  }

  function getWidgetRenderState(
    widgetId: WidgetId
  ): WidgetRenderState | undefined {
    if (!isWidgetId(widgetId)) return undefined

    const { graphId } = parseWidgetId(widgetId)
    return graphWidgets.value.get(graphId)?.get(widgetId)?.render
  }

  function getWidgetVisibility(
    widgetId: WidgetId
  ): WidgetVisibilityComponent | undefined {
    if (!isWidgetId(widgetId)) return undefined

    const { graphId } = parseWidgetId(widgetId)
    return graphWidgets.value.get(graphId)?.get(widgetId)?.visibility
  }

  function setValue(
    widgetId: WidgetId,
    value: WidgetState['value'],
    context?: RemoteMutationContext
  ): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    if (context) valueMutationContexts.set(state, context)
    try {
      state.value = value
    } finally {
      valueMutationContexts.delete(state)
    }
    // Setting the same value `state.value` already holds short-circuits
    // `observeValue`'s setter before it can clear the id, so clear it here
    // too: this write is still an authoritative context-carrying one.
    if (context) locallyDirtyWidgets.delete(widgetId)
    return true
  }

  /**
   * Whether `widgetId`'s live value was last set without a
   * `RemoteMutationContext`, i.e. a local edit a doc snapshot reconcile has
   * not yet reflected. See {@link locallyDirtyWidgets}.
   */
  function isLocallyDirty(widgetId: WidgetId): boolean {
    return locallyDirtyWidgets.has(widgetId)
  }

  function setLabel(widgetId: WidgetId, label: string): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    state.label = label
    return true
  }

  function updateOptions(
    widgetId: WidgetId,
    options: Partial<WidgetState['options']>
  ): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    const visibility = getWidgetVisibility(widgetId)
    if (visibility) {
      if (options.hidden !== undefined) {
        applyLegacyHiddenWrite(visibility, options.hidden)
      }
      if (options.hideInPanel !== undefined) {
        setWidgetHiddenInPanel(visibility, options.hideInPanel)
      }
      if (options.advanced !== undefined) {
        setWidgetAdvanced(visibility, options.advanced, ['vueNode', 'panel'])
      }
    }
    state.options = { ...state.options, ...options }
    return true
  }

  function deleteWidget(widgetId: WidgetId): boolean {
    if (!isWidgetId(widgetId)) return false

    const { graphId } = parseWidgetId(widgetId)
    removeNodeWidgetOrder(widgetId)
    locallyDirtyWidgets.delete(widgetId)
    return graphWidgets.value.get(graphId)?.delete(widgetId) ?? false
  }

  function renameWidget(
    oldId: WidgetId,
    newId: WidgetId
  ): WidgetState | undefined {
    if (!isWidgetId(oldId) || !isWidgetId(newId)) return undefined
    if (oldId === newId) return getWidget(oldId)

    const previous = parseWidgetId(oldId)
    const next = parseWidgetId(newId)
    if (previous.graphId !== next.graphId || previous.nodeId !== next.nodeId) {
      return undefined
    }

    const { graphId, nodeId, name } = next
    const widgets = findGraphWidgets(graphId)
    if (!widgets) return undefined
    const entity = widgets.get(oldId)
    if (!entity || widgets.has(newId)) return undefined

    const order = graphNodeWidgetOrders.value.get(graphId)?.get(nodeId)
    if (!order) return undefined
    const index = order.indexOf(oldId)

    widgets.delete(oldId)
    entity.state.name = name
    widgets.set(newId, entity)
    if (index === -1) order.push(newId)
    else order.splice(index, 1, newId)

    return entity.state
  }

  function getNodeWidgets(graphId: UUID, localNodeId: NodeId): WidgetState[] {
    return getNodeWidgetIds(graphId, localNodeId).flatMap((id) => {
      const state = getWidget(id)
      return state ? [state] : []
    })
  }

  /**
   * Merges a requested widget order against the ids already tracked for the
   * node: the request is filtered to tracked ids, then any tracked id the
   * request omitted is appended. Tracked ids are never dropped here — only
   * {@link removeNodeWidgetOrder} removes an id from the order.
   */
  function reconcileNodeWidgetOrder(
    graphId: UUID,
    localNodeId: NodeId,
    orderedWidgetIds: readonly WidgetId[]
  ): WidgetId[] {
    const currentOrder = getNodeWidgetIds(graphId, localNodeId)
    const currentIds = new Set(currentOrder)
    const nextOrder = orderedWidgetIds.filter((id) => currentIds.has(id))
    const nextIds = new Set(nextOrder)
    return [...nextOrder, ...currentOrder.filter((id) => !nextIds.has(id))]
  }

  function getNodeWidgetIds(graphId: UUID, localNodeId: NodeId): WidgetId[] {
    return [
      ...(graphNodeWidgetOrders.value.get(graphId)?.get(localNodeId) ?? [])
    ]
  }

  function setNodeWidgetOrder(
    graphId: UUID,
    localNodeId: NodeId,
    orderedWidgetIds: readonly WidgetId[]
  ): void {
    const nextOrder = reconcileNodeWidgetOrder(
      graphId,
      localNodeId,
      orderedWidgetIds
    )
    const order = getNodeWidgetOrder(graphId, localNodeId)
    order.splice(0, order.length, ...nextOrder)
  }

  function replaceNodeWidgetOrder(
    graphId: UUID,
    localNodeId: NodeId,
    orderedWidgetIds: readonly WidgetId[]
  ): void {
    const widgets = findGraphWidgets(graphId)
    const nextOrder = orderedWidgetIds.filter(
      (id) => widgets?.get(id)?.state.nodeId === localNodeId
    )
    const graphOrders = getGraphNodeWidgetOrders(graphId)
    const order = graphOrders.get(localNodeId)

    if (nextOrder.length === 0) {
      graphOrders.delete(localNodeId)
    } else if (order) {
      order.splice(0, order.length, ...nextOrder)
    } else {
      graphOrders.set(localNodeId, reactive([...nextOrder]))
    }
  }

  /**
   * Releases the widget ids tracked for a node, from the store's own record
   * rather than the node's live widget list — the two diverge once a node drops
   * widgets without unregistering them. `discardValues` also drops the widget
   * states; retaining them lets a node that comes back keep what the user set.
   */
  function releaseNodeWidgets(
    graphId: UUID,
    localNodeId: NodeId,
    { discardValues }: { discardValues: boolean }
  ): void {
    const graphOrders = graphNodeWidgetOrders.value.get(graphId)
    if (!graphOrders) return

    const order = graphOrders.get(localNodeId)
    if (!order) return

    if (discardValues) {
      for (const widgetId of order) {
        graphWidgets.value.get(graphId)?.delete(widgetId)
        locallyDirtyWidgets.delete(widgetId)
      }
    }
    graphOrders.delete(localNodeId)
  }

  function clearNode(
    graphId: UUID,
    nodeId: NodeId,
    _context?: RemoteMutationContext
  ): void {
    graphWidgetRestorations.get(graphId)?.delete(nodeId)
    const widgets = graphWidgets.value.get(graphId)
    if (widgets) {
      for (const [id, entity] of widgets) {
        if (entity.state.nodeId !== nodeId) continue
        widgets.delete(id)
        locallyDirtyWidgets.delete(id)
      }
      if (widgets.size === 0) graphWidgets.value.delete(graphId)
    }

    const widgetOrders = graphNodeWidgetOrders.value.get(graphId)
    widgetOrders?.delete(nodeId)
    if (widgetOrders?.size === 0) graphNodeWidgetOrders.value.delete(graphId)
  }

  function clearGraph(graphId: UUID): void {
    for (const id of graphWidgets.value.get(graphId)?.keys() ?? []) {
      locallyDirtyWidgets.delete(id)
    }
    graphWidgets.value.delete(graphId)
    graphNodeWidgetOrders.value.delete(graphId)
    graphWidgetRestorations.delete(graphId)
  }

  return {
    registerWidget,
    setNodeWidgetRestoration,
    clearNodeWidgetRestoration,
    getRestoredWidgetValue,
    getWidget,
    getWidgetRenderState,
    getWidgetVisibility,
    onValueChange,
    setValue,
    isLocallyDirty,
    withLocalDirtyTrackingSuppressed,
    beginLocalDirtyTrackingSuppression,
    endLocalDirtyTrackingSuppression,
    setLabel,
    updateOptions,
    deleteWidget,
    renameWidget,
    getNodeWidgets,
    getNodeWidgetIds,
    setNodeWidgetOrder,
    replaceNodeWidgetOrder,
    removeNodeWidgetOrder,
    releaseNodeWidgets,
    clearNode,
    clearGraph
  }
})
