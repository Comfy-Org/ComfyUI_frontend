import { toString } from 'es-toolkit/compat'
import { shallowRef, toRaw } from 'vue'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import {
  attachNodeToStores,
  detachAllNodesFromStores,
  detachNodeFromStores
} from '@/core/graph/nodeShell/nodeShellLifecycle'
import type { UUID } from '@/utils/uuid'
import { createUuidv4, zeroUuid } from '@/utils/uuid'
import {
  attachGroupLayout,
  attachNodeLayout,
  detachGraphLayouts,
  detachGroupLayout,
  detachNodeLayout,
  detachRerouteLayout,
  materializeRerouteLayout
} from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { nodesInRenderOrder } from '@/renderer/core/canvas/litegraph/arrangeForLegacyRender'
import { useLinkStore } from '@/stores/linkStore'
import type { EndpointUpdate } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toLinkId } from '@/types/linkId'
import { isFloatingTopology } from '@/types/linkTopology'
import { toRerouteId } from '@/types/rerouteId'
import { graphScopeOf, toRootGraphId } from '@/types/graphScopeId'
import {
  MINT_ID_MIN,
  createLGraphState,
  mintGroupId,
  mintLinkId,
  mintNodeId,
  mintRerouteId,
  observeGroupId,
  observeLinkId,
  observeNodeId,
  observeRerouteId
} from './idAllocation'
import type { LGraphState } from './idAllocation'
import {
  inputHasLink,
  inputLink,
  outputHasLinks,
  outputLinks
} from './node/slotLinks'
import { normalizeWidgetsView } from './node/widgetsView'
import { clearNodeOwnedStoreState } from '@/stores/clearNodeOwnedStoreState'
import { useEntityIdStore } from '@/stores/entityIdStore'
import { useExecutionOrderStore } from '@/stores/executionOrderStore'
import { useGraphMetadataStore } from '@/stores/graphMetadataStore'
import { rekeyGraphId } from '@/stores/rekeyGraphId'
import {
  UNASSIGNED_NODE_ID,
  compareNodeIds,
  parseNodeId,
  serializeNodeId,
  toNodeId
} from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { forEachNode, visitGraphNodes } from '@/utils/graphTraversalUtil'

import {
  normalizeConfiguredTopology,
  realignInputLinkSlots
} from './linkDeduplication'
import {
  countRequestedNodeIds,
  getRemintedEndpointPatch,
  recordUnambiguousRemint
} from './remintLinkRemap'
import {
  beginNamedValuesShadowDiffLoad,
  endNamedValuesShadowDiffLoad
} from './utils/namedValuesShadowDiffTelemetry'

import type { DragAndScaleState } from './DragAndScale'
import { LGraphCanvas } from './LGraphCanvas'
import { Rectangle } from './infrastructure/Rectangle'
import { LGraphGroup } from './LGraphGroup'
import { LGraphNode } from './LGraphNode'
import {
  LLink,
  registerLinkTopology,
  resolveLinkTopology,
  unregisterAllLinkTopologies,
  unregisterLinkTopology
} from './LLink'
import { LinkMap } from './LinkMap'
import type { LinkId } from './LLink'
import { MapProxyHandler } from './MapProxyHandler'
import {
  registerRerouteChain,
  Reroute,
  unregisterAllRerouteChains,
  unregisterRerouteChain
} from './Reroute'
import type { RerouteId } from './Reroute'
import { CustomEventTarget } from './infrastructure/CustomEventTarget'
import type { LGraphEventMap } from './infrastructure/LGraphEventMap'
import type { SubgraphEventMap } from './infrastructure/SubgraphEventMap'
import type {
  DefaultConnectionColors,
  Dictionary,
  HasBoundingRect,
  INodeInputSlot,
  INodeOutputSlot,
  LinkNetwork,
  LinkSegment,
  MethodNames,
  OptionalProps,
  Point,
  Positionable,
  Size
} from './interfaces'
import { LiteGraph, SubgraphNode } from './litegraph'
import {
  alignOutsideContainer,
  alignToContainer,
  createBounds,
  snapPoint
} from './measure'
import { warnDeprecated } from './utils/feedback'
import { SubgraphInput } from './subgraph/SubgraphInput'
import { SubgraphInputNode } from './subgraph/SubgraphInputNode'
import { SubgraphOutput } from './subgraph/SubgraphOutput'
import { SubgraphOutputNode } from './subgraph/SubgraphOutputNode'
import {
  findReleasableSubgraphs,
  findUsedSubgraphIds,
  getBoundaryLinks,
  groupResolvedByOutput,
  mapSubgraphInputsAndLinks,
  mapSubgraphOutputsAndLinks,
  multiClone,
  splitPositionables
} from './subgraph/subgraphUtils'
import { Alignment, LGraphEventMode } from './types/globalEnums'
import type {
  LGraphTriggerAction,
  LGraphTriggerEvent,
  LGraphTriggerHandler,
  LGraphTriggerParam
} from './types/graphTriggers'
import { LGraphTriggerActions } from './types/graphTriggers'
import type {
  ExportedSubgraph,
  ExposedWidget,
  ISerialisedGraph,
  ISerialisedNode,
  Serialisable,
  SerialisableGraph,
  SerialisableReroute
} from './types/serialisation'
import { getAllNestedItems } from './utils/collections'
import {
  extensionConfigureView,
  GRAPH_CANONICAL_FIELDS,
  hydrateExtensionPayload,
  runExtensionSerializeHook
} from './extensionPersistence'
import {
  collectReservedGroupIds,
  collectReservedLinkIds,
  collectReservedRerouteIds,
  normalizeSubgraphDefinitions,
  topologicalSortSubgraphs
} from './subgraph/subgraphDeduplication'

export type {
  LGraphTriggerAction,
  LGraphTriggerParam
} from './types/graphTriggers'

const validTriggerActions = new Set<LGraphTriggerAction>(LGraphTriggerActions)

function isLGraphTriggerAction(action: string): action is LGraphTriggerAction {
  return validTriggerActions.has(action as LGraphTriggerAction)
}

export type RendererType = 'LG' | 'Vue' | 'Vue-corrected'

/**
 * Unique identifier for a subgraph definition. Structurally a {@link UUID};
 * provided as a domain-specific alias for clarity at adoption sites.
 */
export type SubgraphId = UUID

export type { LGraphState } from './idAllocation'

type ParamsArray<T, K extends MethodNames<T>> = Parameters<
  Extract<T[K], (...args: never[]) => unknown>
>[1] extends undefined
  ?
      | Parameters<Extract<T[K], (...args: never[]) => unknown>>
      | Parameters<Extract<T[K], (...args: never[]) => unknown>>[0]
  : Parameters<Extract<T[K], (...args: never[]) => unknown>>

/** Configuration used by {@link LGraph} `config`. */
export interface LGraphConfig {
  /** @deprecated Legacy config - unused */
  align_to_grid?: boolean
  links_ontop?: boolean
}

/** Options for {@link LGraph.add} method. */
export interface GraphAddOptions {
  /** If true, skip recomputing execution order after adding the node. */
  skipComputeOrder?: boolean
  /** If true, the node will be semi-transparent and follow the cursor until placed or cancelled. */
  ghost?: boolean
  /** Mouse event for ghost placement. Used to position node under cursor. */
  dragEvent?: MouseEvent
}

export interface LGraphExtra extends Dictionary<unknown> {
  reroutes?: SerialisableReroute[]
  linkExtensions?: { id: LinkId; parentId: RerouteId | undefined }[]
  ds?: DragAndScaleState
  workflowRendererVersion?: RendererType
}

export interface BaseLGraph {
  /** The root graph. */
  readonly rootGraph: LGraph
}

const nodesBeingRemoved = new WeakSet<LGraphNode>()

function fireNodeRemovalLifecycle(node: LGraphNode): void {
  const graph: LGraph | null = node.graph
  graph?.events.dispatch('node:before-removed', { node })
  node.onRemoved?.()
  clearNodeOwnedStoreState(node)
  graph?.onNodeRemoved?.(node)
}

function fireNodeRemovalLifecycles(nodes: LGraphNode[]): void {
  const pending = nodes.filter((node) => !nodesBeingRemoved.has(node))
  for (const node of pending) nodesBeingRemoved.add(node)
  try {
    for (const node of pending) fireNodeRemovalLifecycle(node)
  } finally {
    for (const node of pending) nodesBeingRemoved.delete(node)
  }
}

function teardownOwnedGraphs(owner: LGraph): void {
  const rootGraphId = owner.rootGraph?.id ?? owner.id
  const initialOwnedGraphs = owner.isRootGraph
    ? [owner, ...owner._subgraphs.values()]
    : [owner]
  const lifecycleNodes = initialOwnedGraphs.flatMap((graph) => [
    ...graph._nodes
  ])

  try {
    fireNodeRemovalLifecycles(lifecycleNodes)
  } finally {
    const ownedGraphs = new Set(initialOwnedGraphs)
    if (owner.isRootGraph) {
      for (const graph of owner._subgraphs.values()) ownedGraphs.add(graph)
    }
    for (const graph of ownedGraphs) {
      unregisterAllLinkTopologies(graph)
      unregisterAllRerouteChains(graph)
      useGraphMetadataStore().clear(rootGraphId, graph.id)
    }
    const nodes = new Set(lifecycleNodes)
    for (const graph of ownedGraphs) {
      for (const node of graph._nodes) nodes.add(node)
    }
    for (const node of nodes) {
      const order = node.order
      detachNodeFromStores(owner, node, 'discard-values')
      node.graph = null
      node.order = order
    }
    detachGraphLayouts([owner], { removeLayouts: !owner.isRootGraph })
  }
}

/** A reroute chain segment, terminal-first. */
interface ChainSegment {
  /** Emitted reroute ids, in walk order. */
  segment: RerouteId[]
  /** `false` if the walk stopped at a broken reference or a cycle. */
  complete: boolean
}

/**
 * Resolves one hop of a reroute chain.
 * @param id The reroute id to resolve.
 * @returns The id to emit and the next id upstream, or `undefined` if the
 * reference is broken.
 */
type ChainStep = (
  id: RerouteId
) => { emit: RerouteId; next: RerouteId | undefined } | undefined

/**
 * Walks a reroute chain, resolving each hop with `step`, until it runs out,
 * hits a broken reference, or detects a cycle.
 * @param start The reroute id to walk from, or `undefined` for an empty chain.
 * @param step Resolves each hop of the chain.
 * @returns The walked segment.
 */
function walkSegment(
  start: RerouteId | undefined,
  step: ChainStep
): ChainSegment {
  const segment: RerouteId[] = []
  const visited = new Set<RerouteId>()
  let id = start
  while (id !== undefined) {
    if (visited.has(id)) {
      console.error('Infinite parentId loop when unpacking')
      return { segment, complete: false }
    }
    visited.add(id)
    const hop = step(id)
    if (!hop) {
      console.error('Broken Id link when unpacking')
      return { segment, complete: false }
    }
    segment.push(hop.emit)
    id = hop.next
  }
  return { segment, complete: true }
}

/**
 * LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
 * supported callbacks:
 * + onNodeAdded: when a new node is added to the graph
 * + onNodeRemoved: when a node inside this graph is removed
 */
function serialiseOwnedTopology(owner: LGraph) {
  const scope = graphScopeOf(owner)
  const topologies = [...useLinkStore().graphTopologies(scope)]
  const serialiseLink = (link: (typeof topologies)[number]) => ({
    id: link.id,
    origin_id: serializeNodeId(link.originNodeId),
    origin_slot: link.originSlot,
    target_id: serializeNodeId(link.targetNodeId),
    target_slot: link.targetSlot,
    type: link.type,
    ...(link.parentId !== undefined && { parentId: link.parentId })
  })
  const links = topologies.filter((link) => !isFloatingTopology(link))
  const floatingLinks = topologies.filter(isFloatingTopology)
  const reroutes = [...owner.reroutes.values()].map((reroute) =>
    reroute.asSerialisable()
  )
  return {
    links: links.length ? links.map(serialiseLink) : undefined,
    floatingLinks: floatingLinks.length
      ? floatingLinks.map(serialiseLink)
      : undefined,
    reroutes: reroutes.length ? reroutes : undefined
  }
}

function serialiseStoredNodes(owner: LGraph, sortNodes: boolean) {
  const adapters = new Map(owner._nodes.map((node) => [node.id, node]))
  const states = useNodeDataStore().getGraphNodesFor(
    owner.rootGraph.id,
    owner.id
  )
  const ordered = sortNodes
    ? [...states].sort((a, b) => compareNodeIds(a.id, b.id))
    : states
  const serialisers = ordered.flatMap((state) => {
    const adapter = adapters.get(state.id)
    return adapter ? [{ adapter, state }] : []
  })
  if (serialisers.length !== ordered.length) {
    const missing = ordered.find((state) => !adapters.has(state.id))
    console.error(
      `Cannot serialize graph ${owner.id} from store: node ${missing?.id} has no live adapter; using live graph nodes`
    )
    const nodes = sortNodes
      ? [...owner._nodes].sort((a, b) => compareNodeIds(a.id, b.id))
      : owner._nodes
    return nodes.map((node) => node.serialize())
  }
  return serialisers.map(({ adapter, state }) =>
    adapter.serializeFromStoreState(state)
  )
}

function serialiseStoredGroups(owner: LGraph) {
  return owner._groups.map((group) => group.serialize())
}

export function serialiseMutableGraphParts(
  owner: LGraph,
  sortNodes: boolean = false
) {
  const nodes = sortNodes
    ? [...owner._nodes].sort((a, b) => compareNodeIds(a.id, b.id))
    : owner._nodes
  return {
    nodes: nodes.map((node) => node.serialize()),
    groups: owner._groups.map((group) => group.serialize()),
    links: owner.links.size
      ? [...owner.links.values()].map((link) => link.asSerialisable())
      : undefined,
    floatingLinks: owner.floatingLinks.size
      ? [...owner.floatingLinks.values()].map((link) => link.asSerialisable())
      : undefined,
    reroutes: owner.reroutes.size
      ? [...owner.reroutes.values()].map((reroute) => reroute.asSerialisable())
      : undefined
  }
}

export class LGraph
  implements LinkNetwork, BaseLGraph, Serialisable<SerialisableGraph>
{
  static serialisedSchemaVersion = 1 as const

  static STATUS_STOPPED = 1
  static STATUS_RUNNING = 2

  /** @internal */
  static proxyWidgetMigrationFlush?: (
    hostNode: SubgraphNode,
    nodeData: ISerialisedNode | undefined
  ) => void

  /** @internal */
  static autoExposePreviewNodes?: (hostNode: SubgraphNode) => void

  /** List of LGraph properties that are manually handled by {@link LGraph.configure}. */
  static readonly ConfigureProperties = new Set([
    'nodes',
    'groups',
    'links',
    'state',
    'reroutes',
    'floatingLinks',
    'id',
    'subgraphs',
    'definitions',
    'inputs',
    'outputs',
    'widgets',
    'inputNode',
    'outputNode',
    'extra'
  ])

  /**
   * Ref-backed so the id reassignment on every workflow load ({@link configure})
   * propagates to reactive consumers keyed by root graph id.
   */
  private readonly _id = shallowRef<UUID>(zeroUuid)
  get id(): UUID {
    return toRaw(this)._id.value
  }
  set id(value: UUID) {
    const raw = toRaw(this)
    if (raw._id.value === value) return
    const rootGraph = raw.rootGraph
    const previousId = raw._id.value
    const populated =
      previousId !== zeroUuid &&
      (raw._nodes.length > 0 ||
        raw._groups.length > 0 ||
        raw.links.size > 0 ||
        raw.floatingLinks.size > 0 ||
        raw.reroutes.size > 0 ||
        raw._subgraphs.size > 0 ||
        (raw instanceof Subgraph &&
          (raw.inputs.length > 0 ||
            raw.outputs.length > 0 ||
            raw.widgets.length > 0)))
    if (populated) {
      console.warn(`Cannot change the ID of populated graph ${previousId}`)
      return
    }
    const isRegisteredSubgraph =
      raw instanceof Subgraph &&
      rootGraph !== raw &&
      rootGraph._subgraphs.get(previousId) === raw
    if (
      isRegisteredSubgraph &&
      (value === rootGraph.id || rootGraph._subgraphs.has(value))
    ) {
      console.warn(
        `Cannot change graph ID ${previousId} to occupied ID ${value}`
      )
      return
    }
    const rekeyed = rekeyGraphId(
      previousId,
      value,
      !rootGraph || rootGraph === raw
        ? { kind: 'root' }
        : { kind: 'subgraph', rootGraphId: rootGraph.id }
    )
    if (!rekeyed) {
      console.warn(
        `Cannot change graph ID ${previousId} to occupied ID ${value}`
      )
      return
    }
    raw._id.value = value
    if (isRegisteredSubgraph) {
      rootGraph._subgraphs.delete(previousId)
      rootGraph._subgraphs.set(value, raw)
    }
  }

  get revision(): number {
    return useGraphMetadataStore().get(this.rootGraph?.id ?? this.id, this.id)
      .revision
  }
  set revision(value: number) {
    useGraphMetadataStore().get(
      this.rootGraph?.id ?? this.id,
      this.id
    ).revision = value
  }

  private readonly _versionRef = shallowRef(-1)
  get _version(): number {
    return toRaw(this)._versionRef.value
  }
  set _version(value: number) {
    toRaw(this)._versionRef.value = value
  }
  /**
   * Indexed property access is deprecated.
   * Backwards compatibility with a Proxy has been added, but will eventually be removed.
   *
   * Use {@link Map} methods:
   * ```
   * const linkId = 123
   * const link = graph.links.get(linkId)
   * // Deprecated: const link = graph.links[linkId]
   * ```
   */
  links: Map<LinkId, LLink> & Record<LinkId, LLink>
  readonly floatingLinks: ReadonlyMap<LinkId, LLink>
  list_of_graphcanvas: LGraphCanvas[] | null
  status: number = LGraph.STATUS_STOPPED

  get state(): LGraphState {
    return useEntityIdStore().get(this.id)
  }

  set state(value: LGraphState) {
    useEntityIdStore().set(this.id, value)
  }

  readonly events = new CustomEventTarget<LGraphEventMap>()
  readonly _subgraphs: Map<SubgraphId, Subgraph> = new Map()
  _nodes: (LGraphNode | SubgraphNode)[] = []
  _nodes_by_id: Record<NodeId, LGraphNode> = {}
  _nodes_in_order: LGraphNode[] = []
  _nodes_executable: LGraphNode[] | null = null
  _groups: LGraphGroup[] = []
  iteration: number = 0
  globaltime: number = 0
  /** @deprecated Unused */
  runningtime: number = 0
  fixedtime: number = 0
  fixedtime_lapse: number = 0.01
  elapsed_time: number = 0.01
  last_update_time: number = 0
  starttime: number = 0
  catch_errors: boolean = true
  execution_timer_id?: number | null
  errors_in_execution?: boolean
  /** @deprecated Unused */
  execution_time!: number
  _last_trigger_time?: number
  filter?: string
  /** Must contain serialisable values, e.g. primitive types */
  get config(): LGraphConfig {
    return useGraphMetadataStore().get(this.rootGraph?.id ?? this.id, this.id)
      .config
  }
  set config(value: LGraphConfig) {
    useGraphMetadataStore().get(this.rootGraph?.id ?? this.id, this.id).config =
      value
  }
  vars: Dictionary<unknown> = {}
  nodes_executing: boolean[] = []
  nodes_actioning: (string | boolean)[] = []
  nodes_executedAction: string[] = []
  get extra(): LGraphExtra {
    return useGraphMetadataStore().get(this.rootGraph?.id ?? this.id, this.id)
      .extra
  }
  set extra(value: LGraphExtra) {
    useGraphMetadataStore().get(this.rootGraph?.id ?? this.id, this.id).extra =
      value
  }

  /** @deprecated Deserialising a workflow sets this unused property. */
  version?: number

  /** @returns Whether the graph has no items */
  get empty(): boolean {
    return this._nodes.length + this._groups.length + this.reroutes.size === 0
  }

  /** @returns All items on the canvas that can be selected */
  *positionableItems(): Generator<LGraphNode | LGraphGroup | Reroute> {
    for (const node of this._nodes) yield node
    for (const group of this._groups) yield group
    for (const reroute of this.reroutes.values()) yield reroute
    return
  }

  private readonly reroutesInternal = new Map<RerouteId, Reroute>()
  /** All reroutes in this graph. */
  public get reroutes(): Map<RerouteId, Reroute> {
    return this.reroutesInternal
  }

  get rootGraph(): LGraph {
    return this
  }

  get isRootGraph(): boolean {
    return this.rootGraph === this
  }

  /** @deprecated See {@link state}.{@link LGraphState.lastNodeId lastNodeId} */
  get last_node_id() {
    return this.state.lastNodeId
  }

  set last_node_id(value) {
    if (value < MINT_ID_MIN) {
      this.state.lastNodeId = value
    } else if (import.meta.env.DEV) {
      console.warn(
        `last_node_id write ${value} is in the coordination-free mint range; ignored`
      )
    }
  }

  /** @deprecated See {@link state}.{@link LGraphState.lastLinkId lastLinkId} */
  get last_link_id() {
    return this.state.lastLinkId
  }

  set last_link_id(value) {
    if (value < MINT_ID_MIN) {
      this.state.lastLinkId = toLinkId(value)
    } else if (import.meta.env.DEV) {
      console.warn(
        `last_link_id write ${value} is in the coordination-free mint range; ignored`
      )
    }
  }

  onNodeAdded?(node: LGraphNode): void
  onNodeRemoved?(node: LGraphNode): void
  onTrigger?: LGraphTriggerHandler
  /**
   * @deprecated Assign a listener to {@link LGraphCanvas.onBeforeChange} instead.
   * This graph-level hook will be removed in a future version.
   */
  onBeforeChange?(graph: LGraph, info?: LGraphNode): void
  onAfterChange?(graph: LGraph, info?: LGraphNode | null): void
  onConnectionChange?(node: LGraphNode): void
  on_change?(graph: LGraph): void
  onSerialize?(data: ISerialisedGraph | SerialisableGraph): void
  onConfigure?(data: ISerialisedGraph | SerialisableGraph): void

  // @ts-expect-error - Private property type needs fixing
  private _input_nodes?: LGraphNode[]

  /**
   * See {@link LGraph}
   * @param o data from previous serialization [optional]
   */
  constructor(o?: ISerialisedGraph | SerialisableGraph) {
    const linkStore = useLinkStore()
    /** @see MapProxyHandler */
    const links = new LinkMap(
      () => (this.rootGraph ? graphScopeOf(this) : undefined),
      (scope) =>
        [...linkStore.graphTopologies(scope)]
          .filter((topology) => !isFloatingTopology(topology))
          .map(resolveLinkTopology)
          .filter((link): link is LLink => link !== undefined),
      linkStore.getRevision,
      (link) => this._addLink(link),
      (id) => this._removeLink(id)
    )
    MapProxyHandler.bindAllMethods(links)
    const handler = new MapProxyHandler<LinkId, LLink>((value) =>
      toLinkId(Number(value))
    )
    this.links = new Proxy(links, handler) as Map<LinkId, LLink> &
      Record<LinkId, LLink>

    this.floatingLinks = new LinkMap(
      () => (this.rootGraph ? graphScopeOf(this) : undefined),
      (scope) =>
        [...linkStore.graphTopologies(scope)]
          .filter(isFloatingTopology)
          .map(resolveLinkTopology)
          .filter((link): link is LLink => link !== undefined),
      linkStore.getRevision,
      (link) => this.addFloatingLink(link),
      (id) => {
        const link = this.floatingLinks.get(id)
        if (!link) return false
        this.removeFloatingLink(link)
        return true
      }
    )

    this.list_of_graphcanvas = null
    this.clear()

    if (o) this.configure(o)
  }

  /**
   * Removes all nodes from this graph
   */
  clear(): void {
    this.stop()
    this.status = LGraph.STATUS_STOPPED

    try {
      teardownOwnedGraphs(this)
    } finally {
      this.resetAfterClear()
    }
  }

  private resetAfterClear(): void {
    const graphId = this.id
    useGraphMetadataStore().clear(this.rootGraph?.id ?? graphId, graphId)
    if (this.isRootGraph) useEntityIdStore().clear(graphId)
    if (this.isRootGraph && graphId !== zeroUuid) {
      useExecutionOrderStore().clearRoot(toRootGraphId(graphId))
      usePreviewExposureStore().clearGraph(graphId)
      useWidgetValueStore().clearGraph(graphId)
      useLinkStore().clearGraph(toRootGraphId(graphId))
      useRerouteStore().clearGraph(toRootGraphId(graphId))
      useNodeDataStore().clearGraph(graphId)
      layoutStore.clearGraph(graphId)
    } else if (this.rootGraph) {
      useExecutionOrderStore().clearGraph(graphScopeOf(this))
    }
    this.reroutes.clear()

    this._subgraphs.clear()
    this._nodes = []
    this._nodes_by_id = {}
    this._nodes_in_order = []
    this._nodes_executable = null
    this._groups = []

    this.id = this.isRootGraph ? createUuidv4() : zeroUuid
    this.revision = 0

    this.state = createLGraphState()

    // used to detect changes
    this._version = -1

    // iterations
    this.iteration = 0

    // custom data
    this.config = {}
    this.vars = {}
    // to store custom data
    this.extra = {}

    // timing
    this.globaltime = 0
    this.runningtime = 0
    this.fixedtime = 0
    this.fixedtime_lapse = 0.01
    this.elapsed_time = 0.01
    this.last_update_time = 0
    this.starttime = 0

    this.catch_errors = true

    this.nodes_executing = []
    this.nodes_actioning = []
    this.nodes_executedAction = []

    // notify canvas to redraw
    this.change()

    this.canvasAction((c) => c.clear())
  }

  get subgraphs(): Map<SubgraphId, Subgraph> {
    return this.rootGraph._subgraphs
  }

  get nodes() {
    void this._version
    return this._nodes
  }

  get groups() {
    return this._groups
  }

  /**
   * Attach Canvas to this graph
   */
  attachCanvas(canvas: LGraphCanvas): void {
    if (!(canvas instanceof LGraphCanvas)) {
      throw new TypeError('attachCanvas expects an LGraphCanvas instance')
    }

    this.primaryCanvas = canvas

    this.list_of_graphcanvas ??= []
    if (!this.list_of_graphcanvas.includes(canvas)) {
      this.list_of_graphcanvas.push(canvas)
    }

    if (canvas.graph === this) return

    canvas.graph?.detachCanvas(canvas)
    canvas.graph = this
    canvas.subgraph = undefined
  }

  /**
   * Detach Canvas from this graph
   */
  detachCanvas(canvas: LGraphCanvas): void {
    canvas.graph = null
    const canvases = this.list_of_graphcanvas
    if (canvases) {
      const pos = canvases.indexOf(canvas)
      if (pos !== -1) canvases.splice(pos, 1)
    }
  }

  /**
   * @deprecated Will be removed in 0.9
   * Starts running this graph every interval milliseconds.
   * @param interval amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
   */
  start(interval?: number): void {
    if (this.status == LGraph.STATUS_RUNNING) return
    this.status = LGraph.STATUS_RUNNING
    this.sendEventToAllNodes('onStart')

    // launch
    this.starttime = LiteGraph.getTime()
    this.last_update_time = this.starttime
    interval ||= 0

    // execute once per frame
    if (
      interval == 0 &&
      typeof window != 'undefined' &&
      window.requestAnimationFrame
    ) {
      const on_frame = () => {
        if (this.execution_timer_id != -1) return

        window.requestAnimationFrame(on_frame)
        this.runStep(1, !this.catch_errors)
      }
      this.execution_timer_id = -1
      on_frame()
    } else {
      // execute every 'interval' ms
      // @ts-expect-error - Timer ID type mismatch needs fixing
      this.execution_timer_id = setInterval(() => {
        // execute
        this.runStep(1, !this.catch_errors)
      }, interval)
    }
  }

  /**
   * @deprecated Will be removed in 0.9
   * Stops the execution loop of the graph
   */
  stop(): void {
    if (this.status == LGraph.STATUS_STOPPED) return

    this.status = LGraph.STATUS_STOPPED
    if (this.execution_timer_id != null) {
      if (this.execution_timer_id != -1) {
        clearInterval(this.execution_timer_id)
      }
      this.execution_timer_id = null
    }

    this.sendEventToAllNodes('onStop')
  }

  /**
   * Run N steps (cycles) of the graph
   * @param num number of steps to run, default is 1
   * @param do_not_catch_errors [optional] if you want to try/catch errors
   * @param limit max number of nodes to execute (used to execute from start to a node)
   */
  runStep(num: number, do_not_catch_errors: boolean, limit?: number): void {
    num = num || 1

    const start = LiteGraph.getTime()
    this.globaltime = 0.001 * (start - this.starttime)

    const nodes = this._nodes_executable || this._nodes
    if (!nodes) return

    limit = limit || nodes.length

    if (do_not_catch_errors) {
      // iterations
      for (let i = 0; i < num; i++) {
        for (let j = 0; j < limit; ++j) {
          const node = nodes[j]
          // FIXME: Looks like copy/paste broken logic - checks for "on", executes "do"
          if (node.mode == LGraphEventMode.ALWAYS && node.onExecute) {
            // wrap node.onExecute();
            node.doExecute?.()
          }
        }

        this.fixedtime += this.fixedtime_lapse
      }
    } else {
      try {
        // iterations
        for (let i = 0; i < num; i++) {
          for (let j = 0; j < limit; ++j) {
            const node = nodes[j]
            if (node.mode == LGraphEventMode.ALWAYS) {
              node.onExecute?.()
            }
          }

          this.fixedtime += this.fixedtime_lapse
        }
        this.errors_in_execution = false
      } catch (error) {
        this.errors_in_execution = true
        if (LiteGraph.throw_errors) throw error

        if (LiteGraph.debug) console.error('Error during execution:', error)
        this.stop()
      }
    }

    const now = LiteGraph.getTime()
    let elapsed = now - start
    if (elapsed == 0) elapsed = 1

    this.execution_time = 0.001 * elapsed
    this.globaltime += 0.001 * elapsed
    this.iteration += 1
    this.elapsed_time = (now - this.last_update_time) * 0.001
    this.last_update_time = now
    this.nodes_executing = []
    this.nodes_actioning = []
    this.nodes_executedAction = []
  }

  /**
   * Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
   * nodes with only inputs.
   */
  updateExecutionOrder(): void {
    this._nodes_in_order = this.computeExecutionOrder(false)
    this._nodes_executable = []
    for (const node of this._nodes_in_order) {
      if (node.onExecute) {
        this._nodes_executable.push(node)
      }
    }
  }

  // This is more internal, it computes the executable nodes in order and returns it
  computeExecutionOrder(
    only_onExecute: boolean,
    set_level?: boolean
  ): LGraphNode[] {
    const L: LGraphNode[] = []
    const S: LGraphNode[] = []
    const M: Dictionary<LGraphNode> = {}
    // to avoid repeating links
    const visited_links: Record<SerializedNodeId, boolean> = {}
    const remaining_links: Record<SerializedNodeId, number> = {}

    // search for the nodes without inputs (starting nodes)
    for (const node of this._nodes) {
      if (only_onExecute && !node.onExecute) {
        continue
      }

      const { id } = node

      // add to pending nodes
      M[id] = node

      // num of input connections
      let num = 0
      if (node.inputs) {
        for (const slotIndex of node.inputs.keys()) {
          if (inputHasLink(this, id, slotIndex)) {
            num += 1
          }
        }
      }

      if (num == 0) {
        // is a starting node
        S.push(node)
        if (set_level) node._level = 1
      } else {
        // num of input links
        if (set_level) node._level = 0
        remaining_links[id] = num
      }
    }

    while (true) {
      // get an starting node
      const node = S.shift()
      if (node === undefined) break

      const { id } = node

      // add to ordered list
      L.push(node)
      // remove from the pending nodes
      delete M[id]

      if (!node.outputs) continue

      // for every output
      for (const slotIndex of node.outputs.keys()) {
        // for every connection
        for (const link of outputLinks(this, id, slotIndex)) {
          // already visited link (ignore it)
          if (visited_links[link.id]) continue

          const target_node = this.getNodeById(link.target_id)
          if (target_node == null) {
            visited_links[link.id] = true
            continue
          }
          const targetId = target_node.id

          if (set_level) {
            node._level ??= 0
            if (!target_node._level || target_node._level <= node._level) {
              target_node._level = node._level + 1
            }
          }

          // mark as visited
          visited_links[link.id] = true
          // reduce the number of links remaining
          remaining_links[targetId] -= 1

          // if no more links, then add to starters array
          if (remaining_links[targetId] == 0) S.push(target_node)
        }
      }
    }

    // the remaining ones (loops)
    for (const i in M) {
      L.push(M[i])
    }

    if (L.length != this._nodes.length && LiteGraph.debug)
      console.warn('something went wrong, nodes missing')

    const topologyOrder = new Map(L.map((node, order) => [node.id, order]))

    // sort now by priority
    L.sort(function (A, B) {
      // @ts-expect-error ctor props
      const Ap = A.constructor.priority || A.priority || 0
      // @ts-expect-error ctor props
      const Bp = B.constructor.priority || B.priority || 0
      // if same priority, sort by order

      return Ap == Bp
        ? (topologyOrder.get(A.id) ?? 0) - (topologyOrder.get(B.id) ?? 0)
        : Ap - Bp
    })

    useExecutionOrderStore().replace(
      graphScopeOf(this),
      L.map((node) => node.id)
    )

    return L
  }

  /**
   * Positions every node in a more readable manner
   */
  arrange(margin?: number, layout?: string): void {
    margin = margin || 100

    const nodes = this.computeExecutionOrder(false, true)
    const columns: LGraphNode[][] = []
    for (const node of nodes) {
      const col = node._level || 1
      columns[col] ||= []
      columns[col].push(node)
    }

    let x = margin

    for (const column of columns) {
      if (!column) continue

      let max_size = 100
      let y = margin + LiteGraph.NODE_TITLE_HEIGHT
      for (const node of column) {
        node.setPos(
          layout == LiteGraph.VERTICAL_LAYOUT ? y : x,
          layout == LiteGraph.VERTICAL_LAYOUT ? x : y
        )
        const max_size_index = layout == LiteGraph.VERTICAL_LAYOUT ? 1 : 0
        if (node.size[max_size_index] > max_size) {
          max_size = node.size[max_size_index]
        }
        const node_size_index = layout == LiteGraph.VERTICAL_LAYOUT ? 0 : 1
        y += node.size[node_size_index] + margin + LiteGraph.NODE_TITLE_HEIGHT
      }
      x += max_size + margin
    }

    this.setDirtyCanvas(true, true)
  }

  /**
   * Returns the amount of time the graph has been running in milliseconds
   * @returns number of milliseconds the graph has been running
   */
  getTime(): number {
    return this.globaltime
  }

  /**
   * Returns the amount of time accumulated using the fixedtime_lapse var.
   * This is used in context where the time increments should be constant
   * @returns number of milliseconds the graph has been running
   */
  getFixedTime(): number {
    return this.fixedtime
  }

  /**
   * Returns the amount of time it took to compute the latest iteration.
   * Take into account that this number could be not correct
   * if the nodes are using graphical actions
   * @returns number of milliseconds it took the last cycle
   */
  getElapsedTime(): number {
    return this.elapsed_time
  }

  /**
   * Increments the internal version counter.
   */
  incrementVersion(): void {
    if (this.versionBatchInvalidated) return
    this._version++
    if (this.versionBatchDepth > 0) this.versionBatchInvalidated = true
  }

  private versionBatchDepth = 0
  private versionBatchInvalidated = false

  batchVersionUpdates<T>(mutation: () => T): T {
    this.versionBatchDepth++
    try {
      return mutation()
    } finally {
      this.versionBatchDepth--
      if (this.versionBatchDepth === 0) this.versionBatchInvalidated = false
    }
  }

  /**
   * @deprecated Will be removed in 0.9
   * Sends an event to all the nodes, useful to trigger stuff
   * @param eventname the name of the event (function to be called)
   * @param params parameters in array format
   */
  sendEventToAllNodes(
    eventname: string,
    params?: object | object[],
    mode?: LGraphEventMode
  ): void {
    mode = mode || LGraphEventMode.ALWAYS

    const nodes = this._nodes_in_order || this._nodes
    if (!nodes) return

    for (const node of nodes) {
      // @ts-expect-error deprecated
      if (!node[eventname] || node.mode != mode) continue
      if (params === undefined) {
        // @ts-expect-error deprecated
        node[eventname]()
      } else if (params && params.constructor === Array) {
        // @ts-expect-error deprecated
        // eslint-disable-next-line prefer-spread
        node[eventname].apply(node, params)
      } else {
        // @ts-expect-error deprecated
        node[eventname](params)
      }
    }
  }

  /**
   * Runs an action on every canvas registered to this graph.
   * @param action Action to run for every canvas
   */
  canvasAction(action: (canvas: LGraphCanvas) => void): void {
    const canvases = this.list_of_graphcanvas
    if (!canvases) return
    for (const canvas of canvases) action(canvas)
  }

  /** @deprecated See {@link LGraph.canvasAction} */
  sendActionToCanvas<T extends MethodNames<LGraphCanvas>>(
    action: T,
    params?: ParamsArray<LGraphCanvas, T>
  ): void {
    const { list_of_graphcanvas } = this
    if (!list_of_graphcanvas) return

    for (const c of list_of_graphcanvas) {
      const method = c[action]

      if (typeof method === 'function') {
        const args =
          params == null ? [] : Array.isArray(params) ? params : [params]
        ;(method as (...args: unknown[]) => unknown).apply(c, args)
      }
    }
  }

  /**
   * Adds a new node instance to this graph
   * @param node the instance of the node
   * @param options Additional options for adding the node
   */
  add(
    node: LGraphNode | LGraphGroup,
    options?: GraphAddOptions
  ): LGraphNode | null | undefined
  /**
   * Adds a new node instance to this graph
   * @param node the instance of the node
   * @param skipComputeOrder If true, skip recomputing execution order
   * @deprecated Use options object instead
   */
  add(
    node: LGraphNode | LGraphGroup | null,
    skipComputeOrder?: boolean
  ): LGraphNode | null | undefined
  add(
    node: LGraphNode | LGraphGroup,
    skipComputeOrderOrOptions?: boolean | GraphAddOptions
  ): LGraphNode | null | undefined {
    if (!node) return

    // Handle backwards compatibility: 2nd arg can be boolean or options
    const opts: GraphAddOptions =
      typeof skipComputeOrderOrOptions === 'object'
        ? skipComputeOrderOrOptions
        : { skipComputeOrder: skipComputeOrderOrOptions ?? false }
    const shouldSkipComputeOrder = opts.skipComputeOrder ?? false

    const { state } = this

    // Ensure created items are snapped
    if (LiteGraph.alwaysSnapToGrid) {
      const snapTo = this.getSnapToGridSize()
      if (snapTo) node.snapToGrid(snapTo)
    }

    // LEGACY: This was changed from constructor === LGraphGroup
    // groups
    if (node instanceof LGraphGroup) {
      if (
        node.id == null ||
        node.id === -1 ||
        layoutStore.getGroupLayout(this.rootGraph.id, node.id)
      ) {
        node.id = mintGroupId(state)
      }
      observeGroupId(state, node.id)

      this._groups.push(node)
      this.setDirtyCanvas(true)
      this.change()
      node.graph = this
      attachGroupLayout(this, node)
      this.incrementVersion()
      return
    }

    node.id = parseNodeId(node.id) ?? UNASSIGNED_NODE_ID

    if (this._nodes.length >= LiteGraph.MAX_NUMBER_OF_NODES) {
      throw 'LiteGraph: max number of nodes in a graph reached'
    }

    // give him an id
    if (node.id == null || node.id === UNASSIGNED_NODE_ID) {
      node.id = mintNodeId(state)
    } else {
      observeNodeId(state, node.id)
    }

    // Set ghost flag before registration so the node state carries it
    if (opts.ghost) {
      node.flags.ghost = true
    }

    normalizeWidgetsView(node)
    node.graph = this

    attachNodeToStores(this, node, () => mintNodeId(state))

    this._nodes.push(node)
    this._nodes_by_id[node.id] = node

    node.onAdded?.(this)

    if (this.config.align_to_grid) node.alignToGrid()

    if (!shouldSkipComputeOrder) this.updateExecutionOrder()

    this.onNodeAdded?.(node)
    this.events.dispatch('node:added', { node })

    // Keep after onNodeAdded so its deferred hooks run before these writes
    // flush Vue.
    attachNodeLayout(this, node)
    this.incrementVersion()

    this.setDirtyCanvas(true)
    this.change()

    if (opts.ghost) {
      this.canvasAction((c) => c.startGhostPlacement(node, opts.dragEvent))
    }

    if (node.isSubgraphNode?.()) {
      forEachNode(node.subgraph, (innerNode) => {
        if (innerNode.isSubgraphNode())
          this.subgraphs.set(innerNode.subgraph.id, innerNode.subgraph)
      })
    }

    // to chain actions
    return node
  }

  /**
   * Removes a node from the graph
   * @param node the instance of the node
   */
  remove(node: LGraphNode | LGraphGroup): void {
    // LEGACY: This was changed from constructor === LiteGraph.LGraphGroup
    if (node instanceof LGraphGroup) {
      this.canvasAction((c) => c.deselect(node))

      const index = this._groups.indexOf(node)
      if (index != -1) {
        this._groups.splice(index, 1)
      }
      detachGroupLayout(node)
      node.graph = undefined
      this.incrementVersion()
      this.setDirtyCanvas(true, true)
      this.change()
      return
    }

    if (nodesBeingRemoved.has(node)) return

    // not found
    if (this._nodes_by_id[node.id] == null) {
      console.warn('LiteGraph: node not found', node)
      return
    }
    // cannot be removed
    if (node.ignore_remove) {
      console.warn('LiteGraph: node cannot be removed', node)
      return
    }

    nodesBeingRemoved.add(node)
    try {
      this.batchVersionUpdates(() => this.removeNode(node))
    } finally {
      nodesBeingRemoved.delete(node)
    }
  }

  private removeNode(node: LGraphNode): void {
    // sure? - almost sure is wrong
    this.beforeChange()

    this.events.dispatch('node:before-removed', { node })

    const { inputs, outputs } = node

    // disconnect inputs
    if (inputs) {
      for (const [i] of inputs.entries()) {
        if (inputHasLink(this, node.id, i)) node.disconnectInput(i, true)
      }
    }

    // disconnect outputs
    if (outputs) {
      for (const i of outputs.keys()) {
        if (outputHasLinks(this, node.id, i)) node.disconnectOutput(i)
      }
    }

    // Floating links
    for (const link of this.floatingLinks.values()) {
      if (link.origin_id === node.id || link.target_id === node.id) {
        this.removeFloatingLink(link)
      }
    }

    if (node.isSubgraphNode()) {
      const releasedSubgraphs = findReleasableSubgraphs(this.rootGraph, node)
      for (const subgraph of releasedSubgraphs) {
        const nodes: LGraphNode[] = []
        visitGraphNodes(subgraph, (node) => nodes.push(node))
        fireNodeRemovalLifecycles(nodes)
      }
      for (const subgraph of releasedSubgraphs) {
        unregisterAllLinkTopologies(subgraph)
        unregisterAllRerouteChains(subgraph)
        detachAllNodesFromStores(subgraph)
        useExecutionOrderStore().clearGraph(graphScopeOf(subgraph))
        useGraphMetadataStore().clear(this.rootGraph.id, subgraph.id)
        this.rootGraph.subgraphs.delete(subgraph.id)
      }
      detachGraphLayouts(releasedSubgraphs)
    }

    // callback
    node.onRemoved?.()
    clearNodeOwnedStoreState(node)

    const order = node.order
    useExecutionOrderStore().remove(graphScopeOf(this), node.id)
    detachNodeFromStores(this, node)
    detachNodeLayout(node)

    node.graph = null
    node.order = order
    this.incrementVersion()

    // remove from canvas render
    const { list_of_graphcanvas } = this
    if (list_of_graphcanvas) {
      for (const canvas of list_of_graphcanvas) {
        if (canvas.selected_nodes[node.id])
          delete canvas.selected_nodes[node.id]

        canvas.deselect(node)
      }
    }

    // remove from containers
    const pos = this._nodes.indexOf(node)
    if (pos != -1) this._nodes.splice(pos, 1)

    delete this._nodes_by_id[node.id]
    this.onNodeRemoved?.(node)
    this.events.dispatch('node:removed', { node })

    // close panels
    this.canvasAction((c) => c.checkPanels())

    this.setDirtyCanvas(true, true)
    // sure? - almost sure is wrong
    this.afterChange()
    this.change()

    this.updateExecutionOrder()
  }

  /**
   * Returns a node by its id.
   */
  getNodeById(id: NodeId | null | undefined): LGraphNode | null {
    return id != null && id !== UNASSIGNED_NODE_ID
      ? this._nodes_by_id[id]
      : null
  }

  /**
   * Returns a list of nodes that matches a class
   * @param classObject the class itself (not an string)
   * @returns a list with all the nodes of this type
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  findNodesByClass(classObject: Function, result?: LGraphNode[]): LGraphNode[] {
    result = result || []
    result.length = 0
    const { _nodes } = this
    for (const node of _nodes) {
      if (node.constructor === classObject) result.push(node)
    }
    return result
  }

  /**
   * Returns a list of nodes that matches a type
   * @param type the name of the node type
   * @returns a list with all the nodes of this type
   */
  findNodesByType(type: string, result: LGraphNode[]): LGraphNode[] {
    const matchType = type.toLowerCase()
    result = result || []
    result.length = 0
    const { _nodes } = this
    for (const node of _nodes) {
      if (node.type?.toLowerCase() == matchType) result.push(node)
    }
    return result
  }

  /**
   * Returns the first node that matches a name in its title
   * @param title the name of the node to search
   * @returns the node or null
   */
  findNodeByTitle(title: string): LGraphNode | null {
    const { _nodes } = this
    for (const node of _nodes) {
      if (node.title == title) return node
    }
    return null
  }

  /**
   * Returns a list of nodes that matches a name
   * @param title the name of the node to search
   * @returns a list with all the nodes with this name
   */
  findNodesByTitle(title: string): LGraphNode[] {
    const result: LGraphNode[] = []
    const { _nodes } = this
    for (const node of _nodes) {
      if (node.title == title) result.push(node)
    }
    return result
  }

  /**
   * Returns the top-most node in this position of the canvas
   * @param x the x coordinate in canvas space
   * @param y the y coordinate in canvas space
   * @param nodeList a list with all the nodes to search from, by default is all the nodes in the graph
   * @returns the node at this position or null
   */
  getNodeOnPos(
    x: number,
    y: number,
    nodeList?: LGraphNode[]
  ): LGraphNode | null {
    const nodes = nodeList || nodesInRenderOrder(this)
    let i = nodes.length
    while (--i >= 0) {
      const node = nodes[i]
      if (node.isPointInside(x, y)) return node
    }
    return null
  }

  /**
   * Returns the top-most group in that position
   * @param x The x coordinate in canvas space
   * @param y The y coordinate in canvas space
   * @returns The group or null
   */
  getGroupOnPos(x: number, y: number): LGraphGroup | undefined {
    // Iterate backwards through groups to find top-most
    for (let i = this._groups.length - 1; i >= 0; i--) {
      const group = this._groups[i]
      if (group.isPointInside(x, y)) {
        return group
      }
    }
    return undefined
  }

  /**
   * Returns the top-most group with a titlebar in the provided position.
   * @param x The x coordinate in canvas space
   * @param y The y coordinate in canvas space
   * @returns The group or null
   */
  getGroupTitlebarOnPos(x: number, y: number): LGraphGroup | undefined {
    // Iterate backwards through groups to find top-most
    for (let i = this._groups.length - 1; i >= 0; i--) {
      const group = this._groups[i]
      if (group.isPointInTitlebar(x, y)) {
        return group
      }
    }
    return undefined
  }

  /**
   * Finds a reroute a the given graph point
   * @param x X co-ordinate in graph space
   * @param y Y co-ordinate in graph space
   * @returns The first reroute under the given co-ordinates, or undefined
   */
  getRerouteOnPos(
    x: number,
    y: number,
    reroutes?: Iterable<Reroute>
  ): Reroute | undefined {
    for (const reroute of reroutes ?? this.reroutes.values()) {
      if (reroute.containsPoint([x, y])) return reroute
    }
  }

  /**
   * Snaps the provided items to a grid.
   *
   * Item positions are rounded to the nearest multiple of {@link LiteGraph.CANVAS_GRID_SIZE}.
   *
   * When {@link LiteGraph.alwaysSnapToGrid} is enabled
   * and the grid size is falsy, a default of 1 is used.
   * @param items The items to be snapped to the grid
   * @todo Currently only snaps nodes.
   */
  snapToGrid(items: Set<Positionable>): void {
    const snapTo = this.getSnapToGridSize()
    if (!snapTo) return

    for (const item of getAllNestedItems(items)) {
      if (!item.pinned) item.snapToGrid(snapTo)
    }
  }

  /**
   * Finds the size of the grid that items should be snapped to when moved.
   * @returns The size of the grid that items should be snapped to
   */
  getSnapToGridSize(): number {
    // Default to 1 when always snapping
    return LiteGraph.alwaysSnapToGrid
      ? LiteGraph.CANVAS_GRID_SIZE || 1
      : LiteGraph.CANVAS_GRID_SIZE
  }

  // ********** GLOBALS *****************
  trigger<A extends LGraphTriggerAction>(
    action: A,
    param: LGraphTriggerParam<A>
  ): void
  trigger(action: string, param: unknown): void
  trigger(action: string, param: unknown) {
    if (!isLGraphTriggerAction(action)) return
    if (!param || typeof param !== 'object') return

    this.onTrigger?.({ type: action, ...param } as LGraphTriggerEvent)
    this.events.dispatch(action, param as never)
  }

  /** @todo Clean up - never implemented. */
  triggerInput(name: string, value: unknown): void {
    const nodes = this.findNodesByTitle(name)
    for (const node of nodes) {
      // @ts-expect-error - onTrigger method may not exist on all node types
      node.onTrigger(value)
    }
  }

  /** @todo Clean up - never implemented. */
  setCallback(name: string, func?: () => void): void {
    const nodes = this.findNodesByTitle(name)
    for (const node of nodes) {
      // @ts-expect-error - setTrigger method may not exist on all node types
      node.setTrigger(func)
    }
  }

  // used for undo, called before any change is made to the graph
  beforeChange(info?: LGraphNode): void {
    if (this.onBeforeChange) {
      warnDeprecated(
        'LGraph.onBeforeChange is deprecated and will be removed in a future version. Assign a listener to LGraphCanvas.onBeforeChange instead.'
      )
      this.onBeforeChange(this, info)
    }
    this.canvasAction((c) => c.onBeforeChange?.(this))
  }

  // used to resend actions, called after any change is made to the graph
  afterChange(info?: LGraphNode | null): void {
    this.onAfterChange?.(this, info)
    this.canvasAction((c) => c.onAfterChange?.(this))
  }

  /**
   * clears the triggered slot animation in all links (stop visual animation)
   */
  clearTriggeredSlots(): void {
    for (const link_info of this.links.values()) {
      if (!link_info) continue

      if (link_info._last_time) link_info._last_time = 0
    }
  }

  /* Called when something visually changed (not the graph!) */
  change(): void {
    this.canvasAction((c) => c.setDirty(true, true))
    this.on_change?.(this)
  }

  setDirtyCanvas(fg: boolean, bg?: boolean): void {
    this.canvasAction((c) => c.setDirty(fg, bg))
  }

  addFloatingLink(link: LLink): LLink | undefined {
    if (link.id === -1) {
      link.id = mintLinkId(this.state)
    }

    if (!registerLinkTopology(this, link)) return
    observeLinkId(this.state, link.id)
    return link
  }

  removeFloatingLink(link: LLink): void {
    if (this.floatingLinks.get(link.id) !== link) return
    unregisterLinkTopology(link)

    const reroutes = LLink.getReroutes(this, link)
    for (const reroute of reroutes) {
      if (reroute.floatingLinkIds.size === 0) {
        reroute.floating = undefined
      }

      if (reroute.totalLinks === 0) this.removeReroute(reroute.id)
    }
  }

  /**
   * Registers a link in the root-wide identity store.
   */
  _addLink(link: LLink): boolean {
    if (!registerLinkTopology(this, link)) return false
    observeLinkId(this.state, link.id)
    return true
  }

  /**
   * Removes a link from the root-wide identity store and its layout store.
   */
  _removeLink(linkId: LinkId): boolean {
    const link = this.links.get(linkId)
    if (!link) return false
    unregisterLinkTopology(link)
    layoutStore.deleteLinkLayout(linkId)
    return true
  }

  /**
   * Finds the link with the provided ID.
   * @param id ID of link to find
   * @returns The link with the provided {@link id}, otherwise `undefined`. Always returns `undefined` if `id` is nullish.
   */
  getLink(id: null | undefined): undefined
  getLink(id: LinkId | null | undefined): LLink | undefined
  getLink(id: LinkId | null | undefined): LLink | undefined {
    return id == null ? undefined : this.links.get(id)
  }

  /**
   * Finds the reroute with the provided ID.
   * @param id ID of reroute to find
   * @returns The reroute with the provided {@link id}, otherwise `undefined`. Always returns `undefined` if `id` is nullish.
   */
  getReroute(id: null | undefined): undefined
  getReroute(id: RerouteId | null | undefined): Reroute | undefined
  getReroute(id: RerouteId | null | undefined): Reroute | undefined {
    return id == null ? undefined : this.reroutes.get(id)
  }

  /**
   * Adds a reroute to this graph's {@link reroutes} map and registers its
   * chain state with the reroute store. The single entry point for
   * populating {@link reroutes}; routing every add through here keeps the
   * store from silently desyncing.
   */
  _addReroute(reroute: Reroute): boolean {
    const existing = this.reroutesInternal.get(reroute.id)
    if (existing) return existing === reroute
    if (!registerRerouteChain(this, reroute)) return false
    this.reroutesInternal.set(reroute.id, reroute)
    materializeRerouteLayout(this, reroute)
    return true
  }

  /**
   * Removes a reroute from this graph's {@link reroutes} map and
   * unregisters it from the reroute and layout stores. The delete-side
   * counterpart to {@link _addReroute}.
   */
  _removeReroute(id: RerouteId): void {
    const reroute = this.reroutesInternal.get(id)
    if (!reroute) return
    this.reroutesInternal.delete(id)
    unregisterRerouteChain(reroute)
    detachRerouteLayout(reroute)
  }

  /**
   * Configures a reroute on the graph where ID is already known (probably deserialisation).
   * Creates the object if it does not exist.
   * @param serialisedReroute See {@link SerialisableReroute}
   */
  setReroute({
    id,
    parentId,
    pos,
    floating
  }: OptionalProps<SerialisableReroute, 'id'>): Reroute | undefined {
    const rerouteId =
      id === undefined ? mintRerouteId(this.state) : toRerouteId(id)
    observeRerouteId(this.state, rerouteId)

    const existingReroute = this.reroutes.get(rerouteId)
    const reroute = existingReroute ?? new Reroute(rerouteId, this, pos)
    reroute.parentId =
      parentId === undefined ? undefined : toRerouteId(parentId)
    if (pos && existingReroute) reroute.pos = pos
    reroute.floating = floating
    if (!this._addReroute(reroute)) return
    return reroute
  }

  /**
   * Creates a new reroute and adds it to the graph.
   * @param pos Position in graph space
   * @param before The existing link segment (reroute, link) that will be after this reroute,
   * going from the node output to input.
   * @returns The newly created reroute, or undefined when the segment cannot be resolved.
   */
  createReroute(pos: Point, before: LinkSegment): Reroute | undefined {
    if (!(before instanceof LLink) && !(before instanceof Reroute)) {
      return
    }
    const chainLinks =
      before instanceof Reroute
        ? [
            ...[...before.linkIds].map((id) => this.links.get(id)),
            ...[...before.floatingLinkIds].map((id) =>
              this.floatingLinks.get(id)
            )
          ]
        : [before]
    const reroute = this.setReroute({
      parentId: before.parentId,
      pos,
      linkIds: []
    })
    if (!reroute) return

    // Splice the new reroute into every chain that contained `before`
    for (const link of chainLinks) {
      if (!link) continue
      if (link.parentId === before.parentId) link.parentId = reroute.id

      const reroutes = LLink.getReroutes(this, link)
      for (const x of reroutes.filter((x) => x.parentId === before.parentId)) {
        x.parentId = reroute.id
      }
    }

    return reroute
  }

  /**
   * Removes a reroute from the graph
   * @param id ID of reroute to remove
   */
  removeReroute(id: RerouteId): void {
    const { reroutes } = this
    const reroute = reroutes.get(id)
    if (!reroute) return

    this.canvasAction((c) => c.deselect(reroute))

    // Extract reroute from the reroute chain
    const { parentId, linkIds, floatingLinkIds } = reroute
    for (const reroute of reroutes.values()) {
      if (reroute.parentId === id) reroute.parentId = parentId
    }

    for (const linkId of linkIds) {
      const link = this.links.get(linkId)
      if (link && link.parentId === id) link.parentId = parentId
    }

    for (const linkId of floatingLinkIds) {
      const link = this.floatingLinks.get(linkId)
      if (!link) {
        console.warn(
          `Removed reroute had floating link ID that did not exist [${linkId}]`
        )
        continue
      }

      // A floating link is a unique branch; if there is no parent reroute, or
      // the parent reroute has any other links, remove this floating link.
      const floatingReroutes = LLink.getReroutes(this, link)
      const lastReroute = floatingReroutes.at(-1)
      const secondLastReroute = floatingReroutes.at(-2)

      if (reroute !== lastReroute) {
        continue
      } else if (secondLastReroute?.totalLinks !== 1) {
        this.removeFloatingLink(link)
      } else if (link.parentId === id) {
        link.parentId = parentId
        secondLastReroute.floating = reroute.floating
      }
    }

    this._removeReroute(id)

    // This does not belong here; it should be handled by the caller, or run by a remove-many API.
    // https://github.com/Comfy-Org/litegraph.js/issues/898
    this.setDirtyCanvas(false, true)
  }

  /**
   * Destroys a link
   */
  removeLink(link_id: LinkId): void {
    const link = this.links.get(link_id)
    if (!link) return

    const node = this.getNodeById(link.target_id)
    node?.disconnectInput(link.target_slot, false)

    link.disconnect(this)
  }

  /**
   * Creates a new subgraph definition, and adds it to the graph.
   * @param data Exported data (typically serialised) to configure the new subgraph with
   * @returns The newly created subgraph definition.
   */
  createSubgraph(data: ExportedSubgraph): Subgraph {
    return this.createSubgraphs([data])[0]
  }

  createSubgraphs(data: ExportedSubgraph[]): Subgraph[] {
    if (!data.length) return []

    const normalized = normalizeSubgraphDefinitions(
      data,
      {
        nodeIds: this.collectReservedNodeIds(),
        groupIds: collectReservedGroupIds(this.rootGraph),
        linkIds: collectReservedLinkIds(this.rootGraph),
        rerouteIds: collectReservedRerouteIds(this.rootGraph)
      },
      this.state
    ).subgraphs
    return this.createNormalizedSubgraphs(normalized)
  }

  private collectReservedNodeIds(
    rootNodes: ISerialisedNode[] = []
  ): Set<NodeId> {
    const reserved = new Set<NodeId>()
    for (const owner of [
      this.rootGraph,
      ...this.rootGraph.subgraphs.values()
    ]) {
      for (const node of owner.nodes) reserved.add(node.id)
    }
    for (const node of rootNodes) reserved.add(toNodeId(node.id))
    return reserved
  }

  private createNormalizedSubgraphs(data: ExportedSubgraph[]): Subgraph[] {
    const subgraphs = data.map((definition) =>
      this.createNormalizedSubgraph(definition)
    )
    for (const definition of topologicalSortSubgraphs(data))
      this.subgraphs.get(definition.id)?.configure(definition)
    return subgraphs
  }

  private createNormalizedSubgraph(normalized: ExportedSubgraph): Subgraph {
    const { id } = normalized

    const subgraph = new Subgraph(this.rootGraph, normalized)
    this.subgraphs.set(id, subgraph)

    // FE: Create node defs
    this.rootGraph.events.dispatch('subgraph-created', {
      subgraph,
      data: normalized
    })
    return subgraph
  }

  convertToSubgraph(items: Set<Positionable>): {
    subgraph: Subgraph
    node: SubgraphNode
  } {
    if (items.size === 0)
      throw new Error('Cannot convert to subgraph: nothing to convert')

    // Record state before conversion for proper undo support
    this.beforeChange()
    this.canvasAction((c) => c.emitBeforeChange())

    try {
      return this._convertToSubgraphImpl(items)
    } finally {
      // Mark state change complete for proper undo support
      this.afterChange()
      this.canvasAction((c) => c.emitAfterChange())
    }
  }

  private _convertToSubgraphImpl(items: Set<Positionable>): {
    subgraph: Subgraph
    node: SubgraphNode
  } {
    const { state, revision, config } = this
    const firstChild = [...items][0]
    if (items.size === 1 && firstChild instanceof LGraphGroup) {
      items = new Set([firstChild])
      firstChild.recomputeInsideNodes()
      firstChild.children.forEach((n) => items.add(n))
    }

    const {
      boundaryLinks,
      boundaryFloatingLinks,
      internalLinks,
      boundaryInputLinks,
      boundaryOutputLinks
    } = getBoundaryLinks(this, items)
    const { nodes, reroutes, groups } = splitPositionables(items)

    const boundingRect = createBounds(items)
    if (!boundingRect)
      throw new Error('Failed to create bounding rect for subgraph')

    const resolvedInputLinks = boundaryInputLinks.map((x) => x.resolve(this))
    const resolvedOutputLinks = boundaryOutputLinks.map((x) => x.resolve(this))

    const clonedNodes = multiClone(nodes)

    // Inputs, outputs, and links
    const links = internalLinks.map((x) => x.asSerialisable())

    const internalReroutes = new Map([...reroutes].map((r) => [r.id, r]))
    const externalReroutes = new Map(
      [...this.reroutes].filter(([id]) => !internalReroutes.has(id))
    )
    const inputs = mapSubgraphInputsAndLinks(
      resolvedInputLinks,
      links,
      internalReroutes
    )
    const outputs = mapSubgraphOutputsAndLinks(
      resolvedOutputLinks,
      links,
      externalReroutes
    )

    // Prepare subgraph data
    const data = {
      id: createUuidv4(),
      name: 'New Subgraph',
      inputNode: {
        id: SUBGRAPH_INPUT_ID,
        bounding: [0, 0, 75, 100]
      },
      outputNode: {
        id: SUBGRAPH_OUTPUT_ID,
        bounding: [0, 0, 75, 100]
      },
      inputs,
      outputs,
      widgets: [],
      version: LGraph.serialisedSchemaVersion,
      state,
      revision,
      config,
      links,
      nodes: clonedNodes,
      reroutes: structuredClone(
        [...reroutes].map((reroute) => reroute.asSerialisable())
      ),
      groups: structuredClone([...groups].map((group) => group.serialize()))
    } satisfies ExportedSubgraph

    // Remove the originals before configuring the subgraph: its internal links
    // reuse the boundary links' target slots, and the link store's first-wins
    // registration would otherwise reject them in favour of the soon-removed
    // originals that still hold those slots.
    for (const resolved of resolvedInputLinks)
      resolved.inputNode?.disconnectInput(
        resolved.inputNode.inputs.indexOf(resolved.input!),
        true
      )
    for (const resolved of resolvedOutputLinks)
      resolved.outputNode?.disconnectOutput(
        resolved.outputNode.outputs.indexOf(resolved.output!),
        resolved.inputNode
      )

    for (const node of nodes) this.remove(node)
    for (const reroute of reroutes) this.removeReroute(reroute.id)
    for (const group of groups) this.remove(group)

    const subgraph = this.createSubgraph(data)
    for (const node of subgraph.nodes) node.onGraphConfigured?.()
    for (const node of subgraph.nodes) node.onAfterGraphConfigured?.()

    subgraph.inputNode.arrange()
    subgraph.outputNode.arrange()
    for (const [ioNode, alignment] of [
      [subgraph.inputNode, Alignment.MidLeft],
      [subgraph.outputNode, Alignment.MidRight]
    ] as const) {
      const aligned = new Rectangle(...ioNode.boundingRect)
      alignOutsideContainer(aligned, alignment, boundingRect, [50, 0])
      ioNode.pos = [aligned[0], aligned[1]]
    }

    this.rootGraph.events.dispatch('convert-to-subgraph', {
      subgraph,
      bounds: boundingRect,
      exportedSubgraph: data,
      boundaryLinks,
      resolvedInputLinks,
      resolvedOutputLinks,
      boundaryFloatingLinks,
      internalLinks
    })

    // Create subgraph node object
    const subgraphNode = LiteGraph.createNode(subgraph.id, subgraph.name, {
      outputs: structuredClone(outputs)
    })
    if (!subgraphNode) throw new Error('Failed to create subgraph node')
    for (let i = 0; i < inputs.length; i++) {
      Object.assign(subgraphNode.inputs[i], inputs[i])
    }

    // Resize to inputs/outputs
    subgraphNode.setSize(subgraphNode.computeSize())

    // Center the subgraph node. The title height is included in the bounding
    // box but not in pos/size, so correct for it in the same assignment.
    const centred = new Rectangle(
      subgraphNode.pos[0],
      subgraphNode.pos[1],
      subgraphNode.size[0],
      subgraphNode.size[1]
    )
    alignToContainer(centred, Alignment.Centre | Alignment.Middle, boundingRect)
    subgraphNode.setPos(
      centred[0],
      centred[1] + LiteGraph.NODE_TITLE_HEIGHT / 2
    )

    // Add the subgraph node to the graph
    this.add(subgraphNode)

    // Group matching input links
    const groupedByOutput = groupResolvedByOutput(resolvedInputLinks)

    // Reconnect input links in parent graph
    let i = 0
    for (const [, connections] of groupedByOutput.entries()) {
      const [firstResolved, ...others] = connections
      const { output, outputNode, link, subgraphInput } = firstResolved

      // Special handling: Subgraph input node
      i++
      if (link.origin_id === SUBGRAPH_INPUT_ID) {
        link.target_id = subgraphNode.id
        link.target_slot = i - 1
        if (subgraphInput instanceof SubgraphInput) {
          subgraphInput.connect(
            subgraphNode.findInputSlotByType(link.type, true, true),
            subgraphNode,
            link.parentId
          )
        } else {
          throw new TypeError('Subgraph input node is not a SubgraphInput')
        }

        for (const resolved of others) {
          resolved.link.disconnect(this)
        }
        continue
      }

      if (!output || !outputNode) {
        console.warn(
          'Convert to Subgraph reconnect: Failed to resolve input link',
          connections[0]
        )
        continue
      }

      const input = subgraphNode.inputs[i - 1]
      outputNode.connectSlots(output, subgraphNode, input, link.parentId)
    }

    // Group matching links
    const outputsGroupedByOutput = groupResolvedByOutput(resolvedOutputLinks)

    // Reconnect output links in parent graph
    i = 0
    for (const [, connections] of outputsGroupedByOutput.entries()) {
      i++
      for (const connection of connections) {
        const { input, inputNode, link, subgraphOutput } = connection
        // Special handling: Subgraph output node
        if (link.target_id === SUBGRAPH_OUTPUT_ID) {
          if (subgraphOutput instanceof SubgraphOutput) {
            subgraphOutput.connect(
              subgraphNode.findOutputSlotByType(link.type, true, true),
              subgraphNode,
              link.parentId
            )
          } else {
            throw new TypeError('Subgraph input node is not a SubgraphInput')
          }
          continue
        }

        if (!input || !inputNode) {
          console.warn(
            'Convert to Subgraph reconnect: Failed to resolve output link',
            connection
          )
          continue
        }

        const output = subgraphNode.outputs[i - 1]
        subgraphNode.connectSlots(output, inputNode, input, link.parentId)
      }
    }

    subgraphNode._setConcreteSlots()
    subgraphNode.arrange()

    this.canvasAction((c) =>
      c.canvas.dispatchEvent(
        new CustomEvent('subgraph-converted', {
          bubbles: true,
          detail: { subgraphNode: subgraphNode as SubgraphNode }
        })
      )
    )

    return { subgraph, node: subgraphNode as SubgraphNode }
  }

  unpackSubgraph(
    subgraphNode: SubgraphNode,
    options?: { skipMissingNodes?: boolean }
  ) {
    if (!(subgraphNode instanceof SubgraphNode))
      throw new Error('Can only unpack Subgraph Nodes')

    // Record state before unpacking for proper undo support
    this.beforeChange()

    try {
      this._unpackSubgraphImpl(subgraphNode, options)
    } finally {
      // Mark state change complete for proper undo support
      this.afterChange()
    }
  }

  private _unpackSubgraphImpl(
    subgraphNode: SubgraphNode,
    options?: { skipMissingNodes?: boolean }
  ) {
    const skipMissingNodes = options?.skipMissingNodes ?? false

    //NOTE: Create bounds can not be called on positionables directly as the subgraph is not being displayed and boundingRect is not initialized.
    //NOTE: NODE_TITLE_HEIGHT is explicitly excluded here
    const positionables = [
      ...subgraphNode.subgraph.nodes,
      ...subgraphNode.subgraph.reroutes.values(),
      ...subgraphNode.subgraph.groups
    ].map((p: { pos: Point; size?: Size }): HasBoundingRect => {
      return {
        boundingRect: [p.pos[0], p.pos[1], p.size?.[0] ?? 0, p.size?.[1] ?? 0]
      }
    })
    const bounds = createBounds(positionables) ?? [0, 0, 0, 0]
    const center = [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2]

    const toSelect: Positionable[] = []
    const offsetX = subgraphNode.pos[0] - center[0] + subgraphNode.size[0] / 2
    const offsetY = subgraphNode.pos[1] - center[1] + subgraphNode.size[1] / 2
    const movedNodes = multiClone(subgraphNode.subgraph.nodes)
    const nodeIdMap = new Map<NodeId, NodeId>()
    for (const n_info of movedNodes) {
      let node = LiteGraph.createNode(String(n_info.type), n_info.title)
      if (!node) {
        if (skipMissingNodes) {
          console.warn(
            `Cannot unpack node of type "${n_info.type}" - node type not found. Creating placeholder node.`
          )
          node = new LGraphNode(
            n_info.title || n_info.type || 'Missing Node',
            String(n_info.type)
          )
          node.last_serialization = n_info
          node.has_errors = true
        } else {
          throw new Error(
            `Cannot unpack: node type "${n_info.type}" is not registered`
          )
        }
      }

      const newNodeId = mintNodeId(this.state)
      nodeIdMap.set(toNodeId(n_info.id), newNodeId)
      node.id = newNodeId
      n_info.id = newNodeId

      // Strip links from serialized data before configure to prevent
      // onConnectionsChange from resolving subgraph-internal link IDs
      // against the parent graph's link map (which may contain unrelated
      // links with the same numeric IDs).
      for (const input of n_info.inputs ?? []) {
        input.link = null
      }
      for (const output of n_info.outputs ?? []) {
        output.links = []
      }

      this.add(node, true)
      node.configure(n_info)
      node.setPos(node.pos[0] + offsetX, node.pos[1] + offsetY)
      toSelect.push(node)
    }
    const groups = structuredClone(
      [...subgraphNode.subgraph.groups].map((g) => g.serialize())
    )
    const newLinks: {
      oid: NodeId
      oslot: number
      tid: NodeId
      tslot: number
      id: LinkId
      iparent?: RerouteId
      eparent?: RerouteId
      externalFirst: boolean
    }[] = []
    for (const [, link] of subgraphNode.subgraph.links) {
      const outerLink =
        link.origin_id === SUBGRAPH_INPUT_ID
          ? inputLink(this, subgraphNode.id, link.origin_slot)
          : undefined
      const originId =
        link.origin_id === SUBGRAPH_INPUT_ID
          ? outerLink?.origin_id
          : link.origin_id === UNASSIGNED_NODE_ID
            ? undefined
            : nodeIdMap.get(link.origin_id)
      if (!originId) {
        console.error('Missing Link ID when unpacking')
        continue
      }
      const originSlot = outerLink?.origin_slot ?? link.origin_slot
      const externalParentId = outerLink?.parentId
      if (link.target_id === SUBGRAPH_OUTPUT_ID) {
        for (const sublink of outputLinks(
          this,
          subgraphNode.id,
          link.target_slot
        )) {
          newLinks.push({
            oid: originId,
            oslot: originSlot,
            tid: sublink.target_id,
            tslot: sublink.target_slot,
            id: link.id,
            iparent: link.parentId,
            eparent: sublink.parentId,
            externalFirst: true
          })
          sublink.parentId = undefined
        }
        continue
      }
      const targetId =
        link.target_id === UNASSIGNED_NODE_ID
          ? undefined
          : nodeIdMap.get(link.target_id)
      if (!targetId) {
        console.error('Missing Link ID when unpacking')
        continue
      }
      newLinks.push({
        oid: originId,
        oslot: originSlot,
        tid: targetId,
        tslot: link.target_slot,
        id: link.id,
        iparent: link.parentId,
        eparent: externalParentId,
        externalFirst: false
      })
    }
    this.remove(subgraphNode)

    // Shared definitions may survive, so unpacked groups need fresh layout
    // ids, like the reroutes below.
    for (const groupInfo of groups) {
      const groupId = mintGroupId(this.rootGraph.state)
      groupInfo.id = groupId
      const group = new LGraphGroup(groupInfo.title, groupId)
      this.add(group, true)
      group.configure(groupInfo)
      group.pos = [group.pos[0] + offsetX, group.pos[1] + offsetY]
      toSelect.push(group)
    }

    // Deduplicate links by (oid, oslot, tid, tslot) to prevent repeated
    // disconnect/reconnect cycles on widget inputs that can shift slot indices.
    const seenLinks = new Set<string>()
    const dedupedNewLinks = newLinks.filter((link) => {
      const key = `${link.oid}\0${link.oslot}\0${link.tid}\0${link.tslot}`
      if (seenLinks.has(key)) return false
      seenLinks.add(key)
      return true
    })

    const linkIdMap = new Map<LinkId, LinkId[]>()
    for (const newLink of dedupedNewLinks) {
      let created: LLink | null | undefined
      if (newLink.oid == SUBGRAPH_INPUT_ID) {
        if (!(this instanceof Subgraph)) {
          console.error('Ignoring link to subgraph outside subgraph')
          continue
        }
        if (newLink.tid === UNASSIGNED_NODE_ID) continue
        const tnode = this.getNodeById(newLink.tid)
        if (!tnode) continue
        created = this.inputNode.slots[newLink.oslot].connect(
          tnode.inputs[newLink.tslot],
          tnode
        )
      } else if (newLink.tid == SUBGRAPH_OUTPUT_ID) {
        if (!(this instanceof Subgraph)) {
          console.error('Ignoring link to subgraph outside subgraph')
          continue
        }
        if (newLink.oid === UNASSIGNED_NODE_ID) continue
        const tnode = this.getNodeById(newLink.oid)
        if (!tnode) continue
        created = this.outputNode.slots[newLink.tslot].connect(
          tnode.outputs[newLink.oslot],
          tnode
        )
      } else {
        if (
          newLink.oid === UNASSIGNED_NODE_ID ||
          newLink.tid === UNASSIGNED_NODE_ID
        )
          continue
        const originNode = this.getNodeById(newLink.oid)
        const targetNode = this.getNodeById(newLink.tid)
        if (!originNode || !targetNode) continue
        created = originNode.connect(newLink.oslot, targetNode, newLink.tslot)
      }
      if (!created) {
        console.error('Failed to create link')
        continue
      }
      //This is a little unwieldy since Map.has isn't a type guard
      const linkIds = linkIdMap.get(newLink.id) ?? []
      linkIds.push(created.id)
      if (!linkIdMap.has(newLink.id)) {
        linkIdMap.set(newLink.id, linkIds)
      }
      newLink.id = created.id
    }
    // Migrate the subgraph's reroutes to fresh ids at their new positions.
    const rerouteIdMap = new Map<RerouteId, RerouteId>()
    const oldReroutes = subgraphNode.subgraph.reroutes
    for (const reroute of oldReroutes.values()) {
      const migratedId = mintRerouteId(this.state)
      const migratedReroute = this.setReroute({
        id: migratedId,
        pos: [reroute.pos[0] + offsetX, reroute.pos[1] + offsetY],
        linkIds: []
      })
      if (!migratedReroute) continue
      rerouteIdMap.set(reroute.id, migratedId)
      toSelect.push(migratedReroute)
    }

    // Stitch each link's chain from its internal (migrated) and external
    // segments, ordered by which side was nearest the input. External hops walk
    // this graph's own reroutes; internal hops walk the old subgraph chain,
    // emitting migrated ids.
    for (const newLink of dedupedNewLinks) {
      const linkInstance = this.links.get(newLink.id)
      if (!linkInstance) continue

      const internal = walkSegment(newLink.iparent, (id) => {
        const emit = rerouteIdMap.get(id)
        return emit === undefined
          ? undefined
          : { emit, next: oldReroutes.get(id)?.parentId }
      })
      const external = walkSegment(newLink.eparent, (id) => {
        const reroute = this.reroutes.get(id)
        return reroute && { emit: id, next: reroute.parentId }
      })
      const [first, second] = newLink.externalFirst
        ? [external, internal]
        : [internal, external]
      const chain = first.complete
        ? [...first.segment, ...second.segment]
        : first.segment

      let segmentEnd: LLink | Reroute = linkInstance
      for (const rerouteId of chain) {
        segmentEnd.parentId = rerouteId
        const next = this.reroutes.get(rerouteId)
        if (!next) break
        segmentEnd = next
      }
    }

    for (const nodeId of nodeIdMap.values()) {
      const node = this._nodes_by_id[nodeId]
      node._setConcreteSlots()
      node.arrange()
    }

    this.canvasAction((c) => c.selectItems(toSelect))
  }

  /**
   * Resolve a path of subgraph node IDs into a list of subgraph nodes.
   * Not intended to be run from subgraphs.
   * @param nodeIds An ordered list of node IDs, from the root graph to the most nested subgraph node
   * @returns An ordered list of nested subgraph nodes.
   */
  resolveSubgraphIdPath(nodeIds: readonly NodeId[]): SubgraphNode[] {
    const result: SubgraphNode[] = []
    let currentGraph: GraphOrSubgraph = this.rootGraph

    for (const nodeId of nodeIds) {
      const node: LGraphNode | null = currentGraph.getNodeById(nodeId)
      if (!node)
        throw new Error(
          `Node [${nodeId}] not found.  ID Path: ${nodeIds.join(':')}`
        )
      if (!node.isSubgraphNode())
        throw new Error(
          `Node [${nodeId}] is not a SubgraphNode.  ID Path: ${nodeIds.join(':')}`
        )

      result.push(node)
      currentGraph = node.subgraph
    }

    return result
  }

  /**
   * Creates a Object containing all the info about this graph, it can be serialized
   * @deprecated Use {@link asSerialisable}, which returns the newer schema version.
   * @returns value of the node
   */
  serialize(option?: { sortNodes: boolean }): ISerialisedGraph {
    const {
      config,
      state,
      groups,
      nodes,
      reroutes,
      extra,
      extensions,
      floatingLinks,
      definitions
    } = this.asSerialisable(option)
    const linkArray = [...this.links.values()]
    const links = linkArray.map((x) => x.serialize())

    if (reroutes?.length) {
      // Link parent IDs cannot go in 0.4 schema arrays
      extra.linkExtensions = linkArray
        .filter((x) => x.parentId !== undefined)
        .map((x) => ({ id: x.id, parentId: x.parentId }))
    }

    extra.reroutes = reroutes?.length ? reroutes : undefined
    return {
      id: this.id,
      revision: this.revision,
      last_node_id: state.lastNodeId,
      last_link_id: state.lastLinkId,
      nodes,
      links,
      floatingLinks,
      groups,
      definitions,
      config,
      extra,
      ...(extensions && { extensions }),
      version: LiteGraph.VERSION
    }
  }

  /**
   * Custom JSON serialization to prevent circular reference errors.
   * Called automatically by JSON.stringify().
   */
  toJSON(): ISerialisedGraph {
    return this.serialize()
  }

  /** @returns The drag and scale state of the first attached canvas, otherwise `undefined`. */
  private _getDragAndScale(): DragAndScaleState | undefined {
    const ds = this.list_of_graphcanvas?.at(0)?.ds
    if (ds) return { scale: ds.scale, offset: ds.offset }
  }

  /**
   * Prepares a shallow copy of this object for immediate serialisation or structuredCloning.
   * The return value should be discarded immediately.
   * @param options Serialise options = currently `sortNodes: boolean`, whether to sort nodes by ID.
   * @returns A shallow copy of parts of this graph, with shallow copies of its serialisable objects.
   * Mutating the properties of the return object may result in changes to your graph.
   * It is intended for use with {@link structuredClone} or {@link JSON.stringify}.
   */
  asSerialisable(options?: {
    sortNodes: boolean
  }): SerialisableGraph &
    Required<Pick<SerialisableGraph, 'nodes' | 'groups' | 'extra'>> {
    const { id, revision, config, state } = this

    const nodes = serialiseStoredNodes(this, options?.sortNodes ?? false)
    const groups = serialiseStoredGroups(this)
    const topology = serialiseOwnedTopology(this)

    // Save scale and offset
    const extra = { ...this.extra }
    if (LiteGraph.saveViewportWithGraph) extra.ds = this._getDragAndScale()
    if (!extra.ds) delete extra.ds

    const data: ReturnType<typeof this.asSerialisable> = {
      id,
      revision,
      version: LGraph.serialisedSchemaVersion,
      config,
      state,
      groups,
      nodes,
      ...topology,
      extra
    }

    if (this.isRootGraph && this._subgraphs.size) {
      const usedSubgraphIds = findUsedSubgraphIds(this, this._subgraphs)
      const usedSubgraphs = [...this._subgraphs.values()]
        .filter((subgraph) => usedSubgraphIds.has(subgraph.id))
        .map((x) => x.asSerialisable())
      if (usedSubgraphs.length > 0) {
        data.definitions = { subgraphs: usedSubgraphs }
      }
    }

    return runExtensionSerializeHook(
      this,
      data,
      GRAPH_CANONICAL_FIELDS,
      this.onSerialize?.bind(this)
    )
  }

  protected _configureBase(data: ISerialisedGraph | SerialisableGraph): void {
    hydrateExtensionPayload(this, data, GRAPH_CANONICAL_FIELDS)
    const { id, extra } = data

    // Create a new graph ID if none is provided or the zero UUID is used on the root graph
    if (id && !(this.isRootGraph && id === zeroUuid)) {
      this.id = id
      if (this.id !== id && this.id === zeroUuid) this.id = createUuidv4()
    } else if (this.id === zeroUuid) {
      this.id = createUuidv4()
    }

    // Extra
    this.extra = extra ? structuredClone(extra) : {}

    // Ensure auto-generated serialisation data is removed from extra
    delete this.extra.linkExtensions
  }

  /**
   * Configure a graph from a JSON string
   * @param data The deserialised object to configure this graph from
   * @param keep_old If `true`, the graph will not be cleared prior to
   * adding the configuration.
   */
  configure(
    data: ISerialisedGraph | SerialisableGraph,
    keep_old?: boolean
  ): boolean | undefined {
    const options: LGraphEventMap['configuring'] = {
      data,
      clearGraph: !keep_old
    }
    const mayContinue = this.events.dispatch('configuring', options)
    if (!mayContinue) return
    if (
      !options.clearGraph &&
      (this._nodes.length > 0 ||
        this._groups.length > 0 ||
        this.links.size > 0 ||
        this.floatingLinks.size > 0 ||
        this.reroutes.size > 0 ||
        this._subgraphs.size > 0)
    ) {
      console.error('Cannot additively configure a populated graph')
      return false
    }

    beginNamedValuesShadowDiffLoad()
    try {
      // TODO: Finish typing configure()
      if (!data) return
      data = normalizeConfiguredTopology(data)
      if (options.clearGraph) this.clear()
      else detachGraphLayouts([this])

      this._configureBase(data)

      if (options.clearGraph) {
        const topologyScope = graphScopeOf(this)
        if (this.isRootGraph) {
          useLinkStore().clearGraph(topologyScope.rootGraphId)
          useRerouteStore().clearGraph(topologyScope.rootGraphId)
          useNodeDataStore().clearGraph(this.id)
          useWidgetValueStore().clearGraph(this.id)
          usePreviewExposureStore().clearGraph(this.id)
          layoutStore.clearGraph(this.id)
        } else {
          useLinkStore().clearOwner(topologyScope)
          useRerouteStore().clearOwner(topologyScope)
          useNodeDataStore().clearOwner(topologyScope)
        }
      }

      let reroutes: SerialisableReroute[] | undefined
      /**
       * Links restored from this payload, in case node-id remints during the
       * node-creation pass require their endpoints to be remapped
       * (ADR-0008). Only payload links are candidates; incumbent links are
       * never touched.
       */
      const addedLinkIds: LinkId[] = []
      // TODO: Determine whether this should this fall back to 0.4.
      if (data.version === 0.4) {
        const { extra } = data
        // Deprecated - old schema version, links are arrays
        if (Array.isArray(data.links)) {
          for (const linkData of data.links) {
            const link = LLink.createFromArray(linkData)
            if (this._addLink(link)) addedLinkIds.push(link.id)
          }
        }
        // #region `extra` embeds for v0.4

        // LLink parentIds
        if (Array.isArray(extra?.linkExtensions)) {
          for (const linkEx of extra.linkExtensions) {
            const link = this.links.get(linkEx.id)
            if (link) link.parentId = linkEx.parentId
          }
        }

        // Reroutes
        reroutes = extra?.reroutes

        // #endregion `extra` embeds for v0.4
      } else {
        // New schema - one version so far, no check required.

        // State - use max to prevent ID collisions across root and subgraphs.
        // Node/link restores route through the observers, which IGNORE
        // mint-range values outright: a pre-guard save could have absorbed a
        // minted id into its serialized counters (subgraph definitions
        // serialize the root state), and any restored floor-or-above value
        // would put the next ++counter allocation inside the mint range.
        if (data.state) {
          const { lastGroupId, lastLinkId, lastNodeId, lastRerouteId } =
            data.state
          const { state } = this
          if (lastGroupId != null)
            state.lastGroupId = Math.max(state.lastGroupId, lastGroupId)
          if (lastLinkId != null) observeLinkId(state, toLinkId(lastLinkId))
          if (lastNodeId != null) observeNodeId(state, toNodeId(lastNodeId))
          if (lastRerouteId != null)
            state.lastRerouteId = toRerouteId(
              Math.max(state.lastRerouteId, lastRerouteId)
            )
        }

        // Links
        if (Array.isArray(data.links)) {
          for (const linkData of data.links) {
            const link = LLink.create(linkData)
            if (this._addLink(link)) addedLinkIds.push(link.id)
          }
        }

        reroutes = data.reroutes
      }

      // Reroutes
      if (Array.isArray(reroutes)) {
        for (const rerouteData of reroutes) {
          this.setReroute(rerouteData)
        }
      }

      const nodesData = data.nodes

      // copy all stored fields
      for (const i in data) {
        if (LGraph.ConfigureProperties.has(i) || !GRAPH_CANONICAL_FIELDS.has(i))
          continue

        // @ts-expect-error #574 Legacy property assignment
        this[i] = data[i]
      }

      // Normalize cloned subgraph definitions before configuring them.
      const subgraphs = data.definitions?.subgraphs
      let effectiveNodesData = nodesData
      if (subgraphs) {
        const normalized = this.isRootGraph
          ? normalizeSubgraphDefinitions(
              subgraphs,
              {
                nodeIds: this.collectReservedNodeIds(nodesData),
                groupIds: collectReservedGroupIds(this, data.groups),
                linkIds: collectReservedLinkIds(this, data.floatingLinks),
                rerouteIds: collectReservedRerouteIds(this)
              },
              this.state,
              nodesData
            )
          : undefined

        const finalSubgraphs = normalized?.subgraphs ?? subgraphs
        effectiveNodesData = normalized?.rootNodes ?? nodesData

        this.createNormalizedSubgraphs(finalSubgraphs)
      }

      let error = false
      const nodeDataMap = new Map<NodeId, ISerialisedNode>()
      const realignmentDataMap = new Map<NodeId, ISerialisedNode>()

      /**
       * Requested (serialized) id → final id for nodes whose id was
       * reminted on collision during `this.add` (ADR-0008). Payload links
       * name nodes by requested id, so their endpoints must follow the
       * remint. Ambiguous requested ids (claimed by >1 payload node) are
       * never recorded — see {@link recordUnambiguousRemint}.
       */
      const remintedIds = new Map<NodeId, NodeId>()

      // create nodes
      this._nodes = []
      if (effectiveNodesData) {
        const requestedIdCounts = countRequestedNodeIds(effectiveNodesData)

        for (const n_info of effectiveNodesData) {
          // stored info
          let node = LiteGraph.createNode(String(n_info.type), n_info.title)
          if (!node) {
            if (LiteGraph.debug)
              console.warn('Node not found or has errors:', n_info.type)

            // in case of error we create a replacement node to avoid losing info
            node = new LGraphNode('', String(n_info.type))
            node.last_serialization = n_info
            node.has_errors = true
            error = true
            // continue;
          }

          // id it or it will create a new id
          const requestedId = toNodeId(n_info.id)
          node.id = requestedId
          // add before configure, otherwise configure cannot create links
          this.add(node, true)
          if (node.id !== requestedId) {
            recordUnambiguousRemint(
              remintedIds,
              requestedIdCounts,
              requestedId,
              node.id
            )
          }
          nodeDataMap.set(node.id, n_info)
          realignmentDataMap.set(node.id, {
            ...n_info,
            inputs: n_info.inputs?.map((input) => ({ ...input }))
          })
        }

        // Follow remints: repoint this payload's link endpoints from
        // requested ids to the reminted ids before nodes configure their
        // slots against those links.
        if (remintedIds.size > 0) {
          const endpointUpdates: EndpointUpdate[] = []
          for (const linkId of addedLinkIds) {
            const link = this.links.get(linkId)
            if (!link) continue
            const patch = getRemintedEndpointPatch(link, remintedIds)
            if (patch) endpointUpdates.push({ topology: link._state, patch })
          }
          if (endpointUpdates.length > 0) {
            const result = useLinkStore().updateEndpoints(
              graphScopeOf(this),
              endpointUpdates
            )
            if (!result.ok) {
              console.error(
                'Failed to remap node-id link endpoints',
                result.error
              )
              error = true
            }
          }
        }

        // configure nodes afterwards so they can reach each other
        for (const [id, nodeData] of nodeDataMap) {
          const node = this.getNodeById(id)
          node?.configure(nodeData)

          if (LiteGraph.alwaysSnapToGrid && node) {
            const snapTo = this.getSnapToGridSize()
            node.snapToGrid(snapTo)

            const snappedSize: Point = [node.size[0], node.size[1]]
            snapPoint(snappedSize, snapTo, 'ceil')
            node.size = snappedSize
          }
        }
      }

      // Floating links
      if (Array.isArray(data.floatingLinks)) {
        for (const linkData of data.floatingLinks) {
          const floatingLink = LLink.create(linkData)
          const patch = getRemintedEndpointPatch(floatingLink, remintedIds)
          if (patch) Object.assign(floatingLink._state, patch)
          if (
            this.links.has(floatingLink.id) ||
            this.floatingLinks.has(floatingLink.id)
          ) {
            floatingLink.id = toLinkId(-1)
          }
          this.addFloatingLink(floatingLink)
        }
      }

      realignInputLinkSlots(this, realignmentDataMap.entries())

      // Drop reroutes that no live link or floating link passes through
      for (const reroute of this.reroutes.values()) {
        if (reroute.totalLinks === 0) {
          this._removeReroute(reroute.id)
        }
      }

      // groups
      this._groups.length = 0
      const groupData = data.groups
      if (groupData) {
        for (const data of groupData) {
          // TODO: Search/remove these global object refs
          const group = new LiteGraph.LGraphGroup()
          group.configure(data)
          this.add(group)
        }
      }

      this.updateExecutionOrder()

      for (const node of this._nodes) {
        if (!(node instanceof SubgraphNode)) continue
        if (node.properties?.proxyWidgets !== undefined) {
          const nodeData = nodeDataMap.get(node.id)
          if (LGraph.proxyWidgetMigrationFlush) {
            LGraph.proxyWidgetMigrationFlush(node, nodeData)
          } else if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
            console.warn(
              '[SubgraphNode] Legacy proxyWidgets were not migrated because no migration flush hook is wired',
              {
                hostNodeId: node.id,
                proxyWidgets: node.properties.proxyWidgets
              }
            )
          }
        }
        LGraph.autoExposePreviewNodes?.(node)
      }

      this.onConfigure?.(extensionConfigureView(this, data))
      this.incrementVersion()

      // Ensure the primary canvas is set to the correct graph
      const { primaryCanvas } = this
      const subgraphId = primaryCanvas?.subgraph?.id
      if (subgraphId) {
        const subgraph = this.subgraphs.get(subgraphId)
        if (subgraph) {
          primaryCanvas.setGraph(subgraph)
        } else {
          primaryCanvas.setGraph(this)
        }
      }

      this.setDirtyCanvas(true, true)
      return error
    } finally {
      endNamedValuesShadowDiffLoad()
      this.events.dispatch('configured')
    }
  }

  private _canvas?: LGraphCanvas
  get primaryCanvas(): LGraphCanvas | undefined {
    return this.rootGraph._canvas
  }

  set primaryCanvas(canvas: LGraphCanvas) {
    this.rootGraph._canvas = canvas
  }

  load(url: string | Blob | URL | File, callback: () => void) {
    // from file
    if (url instanceof Blob || url instanceof File) {
      const reader = new FileReader()
      reader.addEventListener('load', (event) => {
        const result = toString(event.target?.result)
        const data = JSON.parse(result)
        this.configure(data)
        callback?.()
      })

      reader.readAsText(url)
      return
    }

    // is a string, then an URL
    const req = new XMLHttpRequest()
    req.open('GET', url, true)
    req.send(null)
    req.addEventListener('load', () => {
      if (req.status !== 200) {
        console.error('Error loading graph:', req.status, req.response)
        return
      }
      const data = JSON.parse(req.response)
      this.configure(data)
      callback?.()
    })
    req.addEventListener('error', (err) => {
      console.error('Error loading graph:', err)
    })
  }
}

/** Internal; simplifies type definitions. */
export type GraphOrSubgraph = LGraph | Subgraph

// ============================================================================
// TEMPORARY: Subgraph class moved here to resolve circular dependency
// This is a temporary solution until the architecture can be refactored
// TODO: Move back to separate file once circular dependencies are resolved
// ============================================================================

/** A subgraph definition. */
export class Subgraph
  extends LGraph
  implements BaseLGraph, Serialisable<ExportedSubgraph>
{
  override readonly events = new CustomEventTarget<SubgraphEventMap>()

  /** Limits the number of levels / depth that subgraphs may be nested.  Prevents uncontrolled programmatic nesting. */
  static MAX_NESTED_SUBGRAPHS = 1000

  /** The display name of the subgraph. */
  name: string = 'Unnamed Subgraph'
  /** Optional description shown as tooltip when hovering over the subgraph node. */
  description?: string

  readonly inputNode = new SubgraphInputNode(this)
  readonly outputNode = new SubgraphOutputNode(this)

  /** Ordered list of inputs to the subgraph itself. Similar to a reroute, with the input side in the graph, and the output side in the subgraph. */
  readonly inputs: SubgraphInput[] = []
  /** Ordered list of outputs from the subgraph itself. Similar to a reroute, with the input side in the subgraph, and the output side in the graph. */
  readonly outputs: SubgraphOutput[] = []
  /** A list of node widgets displayed in the parent graph, on the subgraph object. */
  readonly widgets: ExposedWidget[] = []

  private _rootGraph: LGraph
  override get rootGraph(): LGraph {
    return this._rootGraph
  }

  override get state(): LGraphState {
    return this._rootGraph.state
  }

  override set state(_value: LGraphState) {
    // No-op: subgraphs share the root graph's state.
  }

  constructor(rootGraph: LGraph, data: ExportedSubgraph) {
    if (!rootGraph) throw new Error('Root graph is required')

    super()

    this._rootGraph = rootGraph
    const cloned = structuredClone(data)
    if (useGraphMetadataStore().has(rootGraph.id, cloned.id)) {
      cloned.id = createUuidv4()
    }
    this._configureBase(cloned)
    this._configureSubgraph(cloned)
  }

  getIoNodeOnPos(
    x: number,
    y: number
  ): SubgraphInputNode | SubgraphOutputNode | undefined {
    const { inputNode, outputNode } = this
    if (inputNode.containsPoint([x, y])) return inputNode
    if (outputNode.containsPoint([x, y])) return outputNode
  }

  private _configureSubgraph(
    data:
      | (ISerialisedGraph & ExportedSubgraph)
      | (SerialisableGraph & ExportedSubgraph)
  ): void {
    const { name, description, inputs, outputs, widgets } = data

    this.name = name
    this.description = description
    if (inputs) {
      this.inputs.length = 0
      for (const input of inputs) {
        const subgraphInput = new SubgraphInput(input, this.inputNode)
        this.inputs.push(subgraphInput)
        this.events.dispatch('input-added', { input: subgraphInput })
      }
    }

    if (outputs) {
      this.outputs.length = 0
      for (const output of outputs) {
        this.outputs.push(new SubgraphOutput(output, this.outputNode))
      }
    }

    if (widgets) {
      this.widgets.length = 0
      for (const widget of widgets) {
        this.widgets.push(widget)
      }
    }

    this.inputNode.configure(data.inputNode)
    this.outputNode.configure(data.outputNode)
    for (const node of this.nodes) node.updateComputedDisabled()
  }

  override configure(
    data:
      | (ISerialisedGraph & ExportedSubgraph)
      | (SerialisableGraph & ExportedSubgraph),
    keep_old?: boolean
  ): boolean | undefined {
    const normalized = normalizeConfiguredTopology(data)
    const r = super.configure(normalized, keep_old)

    this._configureSubgraph(normalized)
    return r
  }

  override attachCanvas(canvas: LGraphCanvas): void {
    super.attachCanvas(canvas)
    canvas.subgraph = this
  }

  addInput(name: string, type: string): SubgraphInput {
    if (name === null || type === null) {
      throw new Error('Name and type are required for subgraph input')
    }

    this.events.dispatch('adding-input', { name, type })

    const input = new SubgraphInput(
      {
        id: createUuidv4(),
        name,
        type
      },
      this.inputNode
    )

    this.inputs.push(input)
    this.events.dispatch('input-added', { input })

    return input
  }

  addOutput(name: string, type: string): SubgraphOutput {
    if (name === null || type === null) {
      throw new Error('Name and type are required for subgraph output')
    }

    this.events.dispatch('adding-output', { name, type })

    const output = new SubgraphOutput(
      {
        id: createUuidv4(),
        name,
        type
      },
      this.outputNode
    )

    this.outputs.push(output)
    this.events.dispatch('output-added', { output })

    return output
  }

  /**
   * Renames an input slot in the subgraph.
   * @param input The input slot to rename.
   * @param name The new name for the input slot.
   */
  renameInput(input: SubgraphInput, name: string): void {
    const index = this.inputs.indexOf(input)
    if (index === -1) {
      console.error('Input not found')
      return
    }

    const oldName = input.displayName
    this.events.dispatch('renaming-input', {
      input,
      index,
      oldName,
      newName: name
    })

    input.label = name
  }

  /**
   * Renames an output slot in the subgraph.
   * @param output The output slot to rename.
   * @param name The new name for the output slot.
   */
  renameOutput(output: SubgraphOutput, name: string): void {
    const index = this.outputs.indexOf(output)
    if (index === -1) {
      console.error('Output not found')
      return
    }

    const oldName = output.displayName
    this.events.dispatch('renaming-output', {
      output,
      index,
      oldName,
      newName: name
    })

    output.label = name
  }

  /**
   * Removes an input slot from the subgraph.
   * @param input The input slot to remove.
   */
  removeInput(input: SubgraphInput): void {
    const index = this.inputs.indexOf(input)
    if (index === -1) {
      console.error('Input not found')
      return
    }

    const mayContinue = this.events.dispatch('removing-input', { input, index })
    if (!mayContinue) return

    input.disconnect()

    this.inputs.splice(index, 1)

    const { length } = this.inputs
    for (let i = index; i < length; i++) {
      this.inputs[i].decrementSlots('inputs')
    }
  }

  /**
   * Removes an output slot from the subgraph.
   * @param output The output slot to remove.
   */
  removeOutput(output: SubgraphOutput): void {
    const index = this.outputs.indexOf(output)
    if (index === -1) {
      console.error('Output not found')
      return
    }

    const mayContinue = this.events.dispatch('removing-output', {
      output,
      index
    })
    if (!mayContinue) return

    output.disconnect()

    this.outputs.splice(index, 1)

    const { length } = this.outputs
    for (let i = index; i < length; i++) {
      this.outputs[i].decrementSlots('outputs')
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    colorContext: DefaultConnectionColors,
    fromSlot?:
      | INodeInputSlot
      | INodeOutputSlot
      | SubgraphInput
      | SubgraphOutput,
    editorAlpha?: number
  ): void {
    this.inputNode.draw(ctx, colorContext, fromSlot, editorAlpha)
    this.outputNode.draw(ctx, colorContext, fromSlot, editorAlpha)
  }

  /**
   * Clones the subgraph, creating an identical copy with a new ID.
   * @returns A new subgraph with the same configuration, but a new ID.
   */
  clone(keepId: boolean = false): Subgraph {
    const exported = this.asSerialisable()
    if (!keepId) exported.id = createUuidv4()

    const subgraph = new Subgraph(this.rootGraph, exported)
    subgraph.configure(exported)
    return subgraph
  }

  override asSerialisable(): ExportedSubgraph &
    Required<Pick<SerialisableGraph, 'nodes' | 'groups' | 'extra'>> {
    const topology = serialiseOwnedTopology(this)
    return {
      id: this.id,
      version: LGraph.serialisedSchemaVersion,
      state: this.state,
      revision: this.revision,
      config: this.config,
      name: this.name,
      ...(this.description && { description: this.description }),
      inputNode: this.inputNode.asSerialisable(),
      outputNode: this.outputNode.asSerialisable(),
      inputs: this.inputs.map((x) => x.asSerialisable()),
      outputs: this.outputs.map((x) => x.asSerialisable()),
      widgets: [...this.widgets],
      nodes: serialiseStoredNodes(this, false),
      groups: serialiseStoredGroups(this),
      ...topology,
      links: topology.links ?? [],
      extra: this.extra
    }
  }
}
