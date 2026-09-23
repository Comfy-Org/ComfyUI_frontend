/**
 * Composition seam for the four mint ports. Layout pieces are injected
 * (workbench must not import renderer); link, widget and title events come
 * from their owning stores/graph. A replace maps to PLACED and never DELETED
 * (the store displaces incumbents internally). Load brackets are a
 * fail-closed boolean over beforeLoadGraph/afterConfigureGraph: a failed load
 * leaves mints suppressed until the next load's pair recloses.
 *
 * `title` and `mode` have no owning Pinia store (a canvas rename or a
 * mode toggle writes straight onto the `LGraphNode` instance via its tracked
 * `title`/`mode` setters, `setTrackedNodeState` - see `nodeShellState.ts`),
 * so their mint port instead listens to the ROOT graph's own
 * `node:property:changed` event, filtered to `property === 'title'` or
 * `property === 'mode'`. Listening only on the root graph's event target
 * (never a subgraph's) is what scopes this to top-level nodes, matching
 * `set_node_field` having no interior/subgraph-instance variant.
 */
import { registerDocBoundRootGraphProbe } from '@/lib/litegraph/src/docBoundGraphs'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { isFloatingTopology } from '@/types/linkTopology'
import { isRemoteMutationContext } from '@/types/graphMutationContext'
import { parseWidgetId } from '@/types/widgetId'
import { findSubgraphNodePathById } from '@/utils/graphTraversalUtil'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'

import type { GraphOperation } from './graphOperations'
import { attachLayoutMintPort } from './layoutMintPort'
import type { LayoutChangeView, LayoutMintPort } from './layoutMintPort'
import { attachLinkMintPort } from './linkMintPort'
import { attachNodeFieldMintPort } from './nodeFieldMintPort'
import { attachWidgetMintPort } from './widgetMintPort'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'

type PropertyChangedEvent = CustomEvent<LGraphEventMap['node:property:changed']>

/** The graph surface the wiring reads for snapshots, scope, and events. */
export interface MintableGraph {
  id: string
  rootGraph?: { id: string }
  getNodeById(id: NodeId): LGraphNode | null
  _nodes: LGraphNode[]
  events: {
    addEventListener(
      type: 'node:property:changed',
      listener: (event: PropertyChangedEvent) => void
    ): void
    removeEventListener(
      type: 'node:property:changed',
      listener: (event: PropertyChangedEvent) => void
    ): void
  }
}

export interface MintPortWiringDeps {
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
  /** The layout store's `onChange`, injected by the composition root. */
  layoutChanges(listener: (change: LayoutChangeView) => void): () => void
  /** `ACTOR_CONFIG.USER_PREFIX`, injected by the composition root. */
  localActorPrefix: string
  /** The live root graph, or null when no workflow is open. */
  getGraph(): MintableGraph | null
  /**
   * The bound workflow's own stored root graph id, or null when no workflow
   * is bound. Read from the workflow's serialized state rather than the live
   * canvas graph, so it names the bound document's graph even while a
   * different tab is on screen or a tab switch is loading another workflow
   * into the shared canvas graph. Scopes layout mints to that graph so a load
   * already in flight when the binding flips cannot mint the new graph's
   * nodes into the old document.
   */
  boundRootGraphId(): RootGraphId | null
}

export interface MintPortWiring {
  session: MintSession
  /** The layout port's intentional-clear window (human clear paths only). */
  runIntentionalClear<T>(fn: () => T): T
  /** Forward from the app extension's `beforeLoadGraph` hook. */
  onBeforeGraphLoad(): void
  /** Forward from the app extension's `afterConfigureGraph` hook. */
  onAfterGraphConfigure(): void
  /** Forward from the app extension's `onGraphLoadError` hook. */
  onGraphLoadFailed(): void
  detach(): void
}

/** `LGraphEventMode`'s finite members; NaN/Infinity/fractions/out-of-range never mint. */
const MINTABLE_NODE_MODES = new Set<number>(
  Object.values(LGraphEventMode).filter(
    (value): value is LGraphEventMode => typeof value === 'number'
  )
)

type NodeFieldMintCandidate =
  | { field: 'title'; value: string }
  | { field: 'mode'; value: number }

/** `set_node_field`'s `title` validator only requires a string; no length bound to mirror. */
function resolveTitleMint(newValue: unknown): NodeFieldMintCandidate | null {
  if (typeof newValue !== 'string') return null
  return { field: 'title', value: newValue }
}

/** Narrows to `LGraphEventMode`'s finite members (see `MINTABLE_NODE_MODES`). */
function resolveModeMint(newValue: unknown): NodeFieldMintCandidate | null {
  if (typeof newValue !== 'number' || !MINTABLE_NODE_MODES.has(newValue))
    return null
  return { field: 'mode', value: newValue }
}

/**
 * Validates and shapes a `node:property:changed` event into a mintable
 * `title`/`mode` field, or null when the property or value isn't one this
 * port mints (see this file's header comment for why title/mode are special).
 */
function resolveMintableField(
  property: string,
  newValue: unknown
): NodeFieldMintCandidate | null {
  if (property === 'title') return resolveTitleMint(newValue)
  if (property === 'mode') return resolveModeMint(newValue)
  return null
}

const activeWirings = new Set<MintPortWiring>()
const bufferedEnqueues: Array<Array<() => void>> = []

export function runMintPortsBuffered<T>(fn: () => T): T {
  const pending: Array<() => void> = []
  bufferedEnqueues.push(pending)
  try {
    const result = fn()
    bufferedEnqueues.pop()
    for (const enqueue of pending) enqueue()
    return result
  } catch (error) {
    bufferedEnqueues.pop()
    throw error
  }
}

export function notifyMintPortsBeforeGraphLoad(): void {
  for (const wiring of activeWirings) wiring.onBeforeGraphLoad()
}

export function notifyMintPortsAfterGraphConfigure(): void {
  for (const wiring of activeWirings) wiring.onAfterGraphConfigure()
}

/**
 * Forward from the app extension's `onGraphLoadError` hook. `afterConfigure
 * Graph`'s own late-attachment retry never runs when a load fails, so a
 * wiring constructed before `getGraph()` first returned non-null would
 * otherwise stay unattached until some later load succeeds. This retries the
 * attach only; it deliberately leaves the load bracket's teardown
 * suppression exactly as `onGraphLoadError`'s failure already left it
 * (fail-closed, per this file's header comment).
 */
export function notifyMintPortsGraphLoadFailed(): void {
  for (const wiring of activeWirings) wiring.onGraphLoadFailed()
}

/**
 * Run a graph mutation that replays already-committed remote state (so the
 * live graph catches up with the stores) without any active mint port echoing
 * it back into the doc as a local op.
 */
export function runMintPortsSuppressed<T>(fn: () => T): T {
  const wirings = [...activeWirings]
  for (const wiring of wirings) wiring.session.beginGraphTeardown()
  try {
    return fn()
  } finally {
    for (const wiring of wirings) wiring.session.endGraphTeardown()
  }
}

/** Run a confirmed root-workflow clear through every active mint port. */
export function runMintPortsIntentionalClear<T>(clear: () => T): T {
  const wirings = [...activeWirings]
  const run = (index: number): T =>
    index === wirings.length
      ? clear()
      : wirings[index].runIntentionalClear(() => run(index + 1))
  return run(0)
}

/**
 * Serialized save-format node. `widgets_values` is NAME-KEYED via the node's
 * own `widgets_values_named` minus non-value widgets (FE-1904: the doc host's
 * sidecar projection accepts only the pinned catalog's `widget_order` names;
 * control widgets like a `button` serialize a named entry but are not in
 * `widget_order`, and any extra key is an opaque server-side 500).
 *
 * A frontend-only class (`isVirtualNode`: Note, MarkdownNote, PrimitiveNode,
 * Get/Set nodes from node packs, subgraph blueprint hosts) has no catalog
 * entry. The applier rejects a name-keyed record for such a class
 * (`uncatalogued_widget_write`) but stores a positional array opaquely, so
 * those keep the positional form `serialize()` already produced.
 */
function serializeForMint(node: LGraphNode): WorkflowNode | null {
  let serialized: Record<string, unknown>
  try {
    serialized = node.serialize() as unknown as Record<string, unknown>
  } catch {
    return null
  }
  delete serialized.__incarnation
  const named = serialized.widgets_values_named
  if (named != null && typeof named === 'object') {
    if (!node.isVirtualNode)
      serialized.widgets_values = valueWidgetsOnly(node, named)
    delete serialized.widgets_values_named
  }
  return serialized as unknown as WorkflowNode
}

function valueWidgetsOnly(
  node: LGraphNode,
  named: object
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(named)) {
    const widget = node.widgets?.find((candidate) => candidate.name === name)
    if (widget && widget.type !== 'button' && widget.serialize !== false) {
      filtered[name] = value
    }
  }
  return filtered
}

export function attachMintPortWiring(deps: MintPortWiringDeps): MintPortWiring {
  const session = createMintSession()
  const enqueue = (operations: GraphOperation[]) => {
    const pending = bufferedEnqueues.at(-1)
    if (pending) pending.push(() => deps.enqueue(operations))
    else deps.enqueue(operations)
  }

  type PlacedListener = Parameters<
    Parameters<typeof attachLinkMintPort>[0]['events']['onPlaced']
  >[0]
  type DeletedListener = Parameters<
    Parameters<typeof attachLinkMintPort>[0]['events']['onDeleted']
  >[0]
  type SetListener = Parameters<
    Parameters<typeof attachWidgetMintPort>[0]['events']['onSet']
  >[0]
  type NodeFieldListener = Parameters<
    Parameters<typeof attachNodeFieldMintPort>[0]['events']['onChange']
  >[0]
  const placedListeners = new Set<PlacedListener>()
  const deletedListeners = new Set<DeletedListener>()
  const setListeners = new Set<SetListener>()
  const nodeFieldListeners = new Set<NodeFieldListener>()

  const linkPort = attachLinkMintPort({
    events: {
      onPlaced(listener) {
        placedListeners.add(listener)
        return () => placedListeners.delete(listener)
      },
      onDeleted(listener) {
        deletedListeners.add(listener)
        return () => deletedListeners.delete(listener)
      }
    },
    session,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    enqueue
  })

  const layoutPort: LayoutMintPort = attachLayoutMintPort({
    changes: { onChange: deps.layoutChanges },
    session,
    severedLinks: linkPort.severances,
    localActorPrefix: deps.localActorPrefix,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    boundRootGraphId: deps.boundRootGraphId,
    source: {
      serializeNode(id) {
        const node = deps.getGraph()?.getNodeById(id as NodeId)
        return node ? serializeForMint(node) : null
      },
      nodeIds() {
        return (deps.getGraph()?._nodes ?? []).map((node) => node.id)
      }
    },
    enqueue
  })

  const widgetPort = attachWidgetMintPort({
    events: {
      onSet(listener) {
        setListeners.add(listener)
        return () => setListeners.delete(listener)
      }
    },
    session,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    rootGraphId() {
      const graph = deps.getGraph()
      if (!graph) return null
      return graph.rootGraph?.id ?? graph.id
    },
    resolveInteriorPath(owningGraphId) {
      const graph = deps.getGraph()
      if (!graph) return null
      return findSubgraphNodePathById(graph as unknown as LGraph, owningGraphId)
    },
    enqueue
  })

  const nodeFieldPort = attachNodeFieldMintPort({
    events: {
      onChange(listener) {
        nodeFieldListeners.add(listener)
        return () => nodeFieldListeners.delete(listener)
      }
    },
    session,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    enqueue
  })

  /**
   * Whether the root graph currently firing `node:property:changed` (the
   * one this port is attached to) is the bound document's own root graph.
   * `app.rootGraph` is a shared instance re-configured per tab: a title/mode
   * write can land after a load's `afterConfigureGraph` re-attaches this
   * port to the newly-configured graph but before `boundRootGraphId()`
   * itself flips to match, which would otherwise mint into the still-bound
   * (outgoing) document against a same-id node in the new one. No stored
   * bound id, or no live graph, cannot be judged foreign - `isDocBound()`
   * gates those cases downstream instead.
   */
  function firedByBoundRootGraph(): boolean {
    const boundRootGraphId = deps.boundRootGraphId()
    if (boundRootGraphId === null) return true
    const graph = deps.getGraph()
    if (!graph) return true
    return (graph.rootGraph?.id ?? graph.id) === boundRootGraphId
  }

  function handlePropertyChanged(event: PropertyChangedEvent): void {
    const { property, nodeId, oldValue, newValue } = event.detail
    // `setTrackedNodeState` already early-returns before dispatching when
    // `oldValue === value`, so this guard is unreachable for callers that go
    // through the tracked setter. It defends against `litegraphService.ts`,
    // `LGraphCanvas.ts`, and `useNodeErrorFlagSync.ts`, which build a
    // `node:property:changed` detail directly and could hand it any
    // `oldValue`/`newValue` pair.
    if (oldValue === newValue) return

    const field = resolveMintableField(property, newValue)
    if (!field) return
    if (!firedByBoundRootGraph()) return

    for (const listener of nodeFieldListeners) listener({ nodeId, ...field })
  }

  let attachedGraphEvents: MintableGraph['events'] | null = null
  function tryAttachGraphEvents(): void {
    const graph = deps.getGraph()
    if (!graph || attachedGraphEvents === graph.events) return
    // This re-attach branch is unreachable in production: `app.rootGraphInternal`
    // is assigned once in `app.ts` setup and never replaced, so `graph.events`
    // is one stable target for the app's lifetime. The real guard against
    // minting into the outgoing document is `firedByBoundRootGraph()`, which
    // compares graph ids (those move per tab even though the instance doesn't).
    if (attachedGraphEvents) {
      attachedGraphEvents.removeEventListener(
        'node:property:changed',
        handlePropertyChanged
      )
    }
    graph.events.addEventListener(
      'node:property:changed',
      handlePropertyChanged
    )
    attachedGraphEvents = graph.events
  }
  tryAttachGraphEvents()

  const linkStore = useLinkStore()
  const widgetStore = useWidgetValueStore()

  const detachLinkActions = linkStore.$onAction(({ name, args, after }) => {
    // The remote origin travels on the store call itself. Do not rely on the
    // old ambient MintSession scope: nested legacy setters can overwrite it.
    if (isRemoteMutationContext(args.at(-1))) return
    if (name === 'registerLink' || name === 'replaceLink') {
      const scope = args[0]
      after((placed) => {
        if (!placed || isFloatingTopology(placed)) return
        for (const listener of placedListeners) listener(scope, placed)
      })
      return
    }
    if (name === 'deleteLink') {
      const [scope, topology] = args
      after((removed) => {
        if (!removed || isFloatingTopology(topology)) return
        for (const listener of deletedListeners) listener(scope, topology)
      })
    }
  })

  const detachWidgetChanges = widgetStore.onValueChange(
    ({ widgetId, value, oldValue, context }) => {
      if (isRemoteMutationContext(context)) return
      const { graphId, nodeId, name: widgetName } = parseWidgetId(widgetId)
      for (const listener of setListeners) {
        listener({
          graphId,
          nodeId,
          name: widgetName,
          value,
          old: oldValue
        })
      }
    }
  )

  let loadBracketOpen = false

  // The ports gate their sends on exactly this trio, so the same read also
  // answers litegraph's mint-time question: a graph whose edits reach the doc
  // is a graph the agent mints into too, and must mint from the disjoint
  // range (`idAllocation.ts`).
  const unregisterDocBoundProbe = registerDocBoundRootGraphProbe(() => {
    if (!deps.isEnabled() || !deps.isDocBound()) return null
    const graph = deps.getGraph()
    if (!graph) return null
    return graph.rootGraph?.id ?? graph.id
  })

  const wiring: MintPortWiring = {
    session,
    runIntentionalClear(fn) {
      return layoutPort.runIntentionalClear(fn)
    },
    onBeforeGraphLoad() {
      if (loadBracketOpen) return
      loadBracketOpen = true
      session.beginGraphTeardown()
    },
    onAfterGraphConfigure() {
      tryAttachGraphEvents()
      if (!loadBracketOpen) return
      loadBracketOpen = false
      session.endGraphTeardown()
    },
    onGraphLoadFailed() {
      tryAttachGraphEvents()
    },
    detach() {
      activeWirings.delete(wiring)
      unregisterDocBoundProbe()
      detachLinkActions()
      detachWidgetChanges()
      if (attachedGraphEvents) {
        attachedGraphEvents.removeEventListener(
          'node:property:changed',
          handlePropertyChanged
        )
        attachedGraphEvents = null
      }
      nodeFieldPort.detach()
      widgetPort.detach()
      layoutPort.detach()
      linkPort.detach()
    }
  }
  activeWirings.add(wiring)
  return wiring
}
