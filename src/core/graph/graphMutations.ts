import { cloneDeep } from 'es-toolkit'

import type {
  ISerialisableNodeInput,
  ISerialisableNodeOutput,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { isWidgetId, widgetId } from '@/types/widgetId'

export interface SemanticNodePayload extends Record<string, unknown> {
  id: string | number
  type: string
}

export interface SemanticLinkPayload {
  id: number
  originNodeId: string | number
  originSlot: number
  targetNodeId: string | number
  targetSlot: number
  type: string | number
  /** Final semantic slot records after the shared applier handled this link. */
  originOutputs?: readonly ISerialisableNodeOutput[]
  targetInputs?: readonly ISerialisableNodeInput[]
}

interface SemanticNodeLayout {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

/**
 * Renderer-owned layout mutation port. Semantic state never imports the
 * renderer or writes position into the shared follower Y.Doc.
 */
interface SemanticLayoutMutationPort {
  createNode(
    scope: GraphScope,
    nodeId: NodeId,
    layout: SemanticNodeLayout,
    context: RemoteMutationContext
  ): void
  deleteNodes(
    scope: GraphScope,
    nodeIds: readonly NodeId[],
    context: RemoteMutationContext
  ): void
}

interface GraphMutationBatch {
  addNode(payload: SemanticNodePayload): void
  reconcileNode(payload: SemanticNodePayload): void
  /**
   * For a node of the same type, resyncs scalar fields while preserving slots,
   * widgets, and layout. A missing node or type mismatch is added or replaced
   * from the full payload.
   */
  reconcileNodeFields(payload: SemanticNodePayload): void
  setWidget(nodeId: NodeId, name: string, value: unknown): void
  connect(link: SemanticLinkPayload): void
  /** Derived cleanup for an authoritative snapshot; not a wire op. */
  removeMissing(
    retainedNodeIds: readonly NodeId[],
    retainedLinkIds: readonly number[]
  ): void
  /** Derived removals emitted by connect/delete effects; not a wire op. */
  removeLinks(linkIds: readonly number[]): void
  deleteNode(nodeId: NodeId, removedLinkIds?: readonly number[]): void
  clearSemanticGraph(): void
}

export interface GraphMutations {
  batch(
    context: RemoteMutationContext,
    define: (batch: GraphMutationBatch) => void
  ): boolean
  addNode(payload: SemanticNodePayload, context: RemoteMutationContext): boolean
  setWidget(
    nodeId: NodeId,
    name: string,
    value: unknown,
    context: RemoteMutationContext
  ): boolean
  connect(link: SemanticLinkPayload, context: RemoteMutationContext): boolean
  deleteNode(
    nodeId: NodeId,
    removedLinkIds: readonly number[],
    context: RemoteMutationContext
  ): boolean
  clearSemanticGraph(context: RemoteMutationContext): boolean
}

export interface GraphMutationsDeps {
  getScope(): GraphScope | null
  layout: SemanticLayoutMutationPort
}

type QueuedMutation =
  | { kind: 'addNode'; payload: SemanticNodePayload }
  | { kind: 'reconcileNode'; payload: SemanticNodePayload }
  | { kind: 'reconcileNodeFields'; payload: SemanticNodePayload }
  | { kind: 'setWidget'; nodeId: NodeId; name: string; value: unknown }
  | { kind: 'connect'; link: SemanticLinkPayload }
  | {
      kind: 'removeMissing'
      retainedNodeIds: readonly NodeId[]
      retainedLinkIds: readonly number[]
    }
  | { kind: 'removeLinks'; linkIds: readonly number[] }
  | {
      kind: 'deleteNode'
      nodeId: NodeId
      removedLinkIds: readonly number[]
    }
  | { kind: 'clearSemanticGraph' }

interface PreparedNode {
  state: NodeState
  layout: SemanticNodeLayout
  widgets: Array<{ name: string; value: WidgetValue; type: string }>
  widgetsAuthoritative: boolean
}

type PreparedMutation =
  | { kind: 'addNode'; node: PreparedNode }
  | { kind: 'reconcileNode'; node: PreparedNode }
  | { kind: 'replaceNode'; node: PreparedNode }
  | { kind: 'reconcileNodeFields'; state: NodeState }
  | { kind: 'setWidget'; nodeId: NodeId; name: string; value: WidgetValue }
  | {
      kind: 'connect'
      topology: LinkTopology
      originOutputs?: NodeState['outputs']
      targetInputs?: NodeState['inputs']
    }
  | {
      kind: 'removeMissing'
      nodeIds: readonly NodeId[]
      linkIds: readonly LinkId[]
    }
  | { kind: 'removeLinks'; linkIds: readonly LinkId[] }
  | {
      kind: 'deleteNode'
      nodeId: NodeId
      removedLinkIds: readonly LinkId[]
    }
  | { kind: 'clearSemanticGraph'; nodeIds: readonly NodeId[] }

type QueuedOf<K extends QueuedMutation['kind']> = Extract<
  QueuedMutation,
  { kind: K }
>
type PreparedOf<K extends PreparedMutation['kind']> = Extract<
  PreparedMutation,
  { kind: K }
>

interface PrepareDraft {
  scope: GraphScope
  nodes: Map<string, NodeState>
  links: Map<LinkId, LinkTopology>
  widgets: Map<string, Set<string>>
}

interface ConnectSlots {
  originOutputs: NodeState['outputs']
  targetInputs: NodeState['inputs']
}

/**
 * `ISerialisedNode.widgets_values` is declared as an array, but some custom
 * nodes override it with a record (see its docs) and op-layer payloads carry
 * values keyed by widget name. These two accessors are the only place the
 * wider shape crosses that boundary; everything else narrows normally.
 */
type StoredWidgetValues = WidgetValue[] | Record<string, WidgetValue>

function storedWidgetValues(
  serialised: ISerialisedNode | undefined
): StoredWidgetValues | undefined {
  return serialised?.widgets_values
}

function setStoredWidgetValues(
  serialised: ISerialisedNode,
  values: StoredWidgetValues | undefined
): void {
  serialised.widgets_values = values as ISerialisedNode['widgets_values']
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? structuredClone(value) : {}
}

/**
 * A supplied input slot whose record has no `link` key carries no link
 * information (as opposed to `link: null`, which means unlinked). Such slots
 * keep the link of the `existing` slot at the same index, or `null` when the
 * node has no slot there yet.
 */
function prepareInputSlots(
  value: unknown,
  existing?: NodeState['inputs']
): NodeState['inputs'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((raw, index) => {
    const slot = structuredClone(raw)
    if (typeof slot.link === 'number') slot.link = toLinkId(slot.link)
    if (slot.link === undefined) slot.link = existing?.[index]?.link ?? null
    return {
      ...slot,
      boundingRect: [0, 0, 0, 0]
    } as unknown as NodeState['inputs'][number]
  })
}

function prepareOutputSlots(value: unknown): NodeState['outputs'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((raw) => {
    const slot = structuredClone(raw)
    if (Array.isArray(slot.links)) {
      slot.links = slot.links.map((id) => toLinkId(Number(id)))
    }
    return {
      ...slot,
      boundingRect: [0, 0, 0, 0]
    } as unknown as NodeState['outputs'][number]
  })
}

function readPair(
  value: unknown,
  fallback: readonly [number, number]
): readonly [number, number] {
  if (!Array.isArray(value) || value.length < 2) return fallback
  const first = Number(value[0])
  const second = Number(value[1])
  return Number.isFinite(first) && Number.isFinite(second)
    ? [first, second]
    : fallback
}

function widgetType(value: unknown): string {
  switch (typeof value) {
    case 'boolean':
      return 'boolean'
    case 'number':
      return 'number'
    case 'string':
      return 'string'
    default:
      return 'legacy'
  }
}

function widgetEntries(payload: SemanticNodePayload): PreparedNode['widgets'] {
  const values = payload.widgets_values
  if (Array.isArray(values)) {
    return values.map((value, index) => ({
      name: String(index),
      value: structuredClone(value) as WidgetValue,
      type: widgetType(value)
    }))
  }
  if (!isRecord(values)) return []
  return Object.entries(values).map(([name, value]) => ({
    name,
    value: structuredClone(value) as WidgetValue,
    type: widgetType(value)
  }))
}

/**
 * Snapshots are derived state: record-shaped values and the named record are
 * updated by name, while a positional array is left as saved because nothing
 * here can prove which slot a name owns.
 */
function syncSerializedWidgetValue(
  state: NodeState,
  name: string,
  value: unknown
): void {
  const serialised = state.lastSerialization
  if (!serialised) return
  const values = storedWidgetValues(serialised)
  const named = serialised.widgets_values_named
  const clone = structuredClone(value) as WidgetValue
  if (isRecord(values)) values[name] = clone
  if (named) named[name] = clone
}

function reconcileInputSlots(
  current: NodeState,
  next: Pick<NodeState, 'inputs' | 'properties'>
): NodeState['inputs'] {
  const promoted = new Map(
    current.inputs
      .filter((input) => '_subgraphSlot' in input && input._subgraphSlot)
      .map((input) => [input.name, input])
  )
  const inputs = next.inputs.map((input) => {
    const existing = promoted.get(input.name)
    promoted.delete(input.name)
    const { link: _link, boundingRect: _bounds, ...metadata } = input
    return existing?.type === input.type
      ? Object.assign(existing, metadata)
      : input
  })
  return Array.isArray(next.properties.proxyWidgets)
    ? [...inputs, ...promoted.values()]
    : inputs
}

function nodeAppearance(
  payload: SemanticNodePayload
): Partial<
  Pick<
    NodeState,
    'bgcolor' | 'boxcolor' | 'color' | 'resizable' | 'shape' | 'showAdvanced'
  >
> {
  return {
    ...(typeof payload.bgcolor === 'string' && { bgcolor: payload.bgcolor }),
    ...(typeof payload.boxcolor === 'string' && { boxcolor: payload.boxcolor }),
    ...(typeof payload.color === 'string' && { color: payload.color }),
    ...(typeof payload.resizable === 'boolean' && {
      resizable: payload.resizable
    }),
    ...(typeof payload.shape === 'number' && { shape: payload.shape }),
    ...(typeof payload.showAdvanced === 'boolean' && {
      showAdvanced: payload.showAdvanced
    })
  }
}

function prepareNode(
  payload: SemanticNodePayload,
  scope: GraphScope,
  existing?: NodeState
): PreparedNode {
  const id = toNodeId(payload.id)
  const [x, y] = readPair(payload.pos, [0, 0])
  const [width, height] = readPair(payload.size, [270, 100])
  const mode = Number(payload.mode)
  const state: NodeState = {
    id,
    graphId: scope.owningGraphId,
    type: payload.type,
    title:
      typeof payload.title === 'string' && payload.title.length > 0
        ? payload.title
        : payload.type,
    flags: cloneRecord(payload.flags),
    inputs: prepareInputSlots(payload.inputs, existing?.inputs),
    outputs: prepareOutputSlots(payload.outputs),
    mode: Number.isInteger(mode) ? mode : 0,
    properties: cloneRecord(payload.properties) as NodeState['properties'],
    lastSerialization: structuredClone(payload) as unknown as ISerialisedNode,
    ...nodeAppearance(payload)
  }
  return {
    state,
    widgets: widgetEntries(payload),
    widgetsAuthoritative:
      Array.isArray(payload.widgets_values) || isRecord(payload.widgets_values),
    layout: {
      position: { x, y },
      size: { width, height }
    }
  }
}

function prepareTopology(
  payload: SemanticLinkPayload,
  scope: GraphScope
): LinkTopology {
  return {
    id: toLinkId(payload.id),
    graphId: scope.owningGraphId,
    originNodeId: toNodeId(payload.originNodeId),
    originSlot: payload.originSlot,
    targetNodeId: toNodeId(payload.targetNodeId),
    targetSlot: payload.targetSlot,
    type: payload.type
  }
}

function nodeKey(nodeId: NodeId): string {
  return String(nodeId)
}

function detachedLinkSlots(
  nodes: Iterable<NodeState>,
  topology: LinkTopology
): Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>> {
  const nodesById = new Map([...nodes].map((node) => [nodeKey(node.id), node]))
  const changed = new Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>>()
  const slotsFor = (node: NodeState) => {
    const prior = changed.get(node.id)
    if (prior) return prior
    const slots = { inputs: node.inputs, outputs: node.outputs }
    changed.set(node.id, slots)
    return slots
  }

  const origin = nodesById.get(nodeKey(topology.originNodeId))
  if (origin?.outputs[topology.originSlot]) {
    const slots = slotsFor(origin)
    slots.outputs = slots.outputs.map((output, index) =>
      index === topology.originSlot
        ? {
            ...output,
            links: output.links?.filter((id) => id !== topology.id) ?? null
          }
        : output
    )
  }

  const target = nodesById.get(nodeKey(topology.targetNodeId))
  if (target?.inputs[topology.targetSlot]?.link === topology.id) {
    const slots = slotsFor(target)
    slots.inputs = slots.inputs.map((input, index) =>
      index === topology.targetSlot ? { ...input, link: null } : input
    )
  }

  return changed
}

function removeIncidentLinks(
  nodes: Map<string, NodeState>,
  links: Map<LinkId, LinkTopology>,
  nodeId: NodeId
): void {
  for (const [id, topology] of [...links]) {
    if (topology.originNodeId === nodeId || topology.targetNodeId === nodeId) {
      removeSimulatedLink(nodes, links, id)
    }
  }
}

function removeSimulatedLink(
  nodes: Map<string, NodeState>,
  links: Map<LinkId, LinkTopology>,
  linkId: LinkId
): void {
  const topology = links.get(linkId)
  if (!topology) return
  links.delete(linkId)
  for (const [nodeId, slots] of detachedLinkSlots(nodes.values(), topology)) {
    const node = nodes.get(nodeKey(nodeId))
    if (node) nodes.set(nodeKey(nodeId), { ...node, ...slots })
  }
}

/**
 * Builds the graph-scoped composite used by the remote follower. Every batch
 * is validated against a simulated final store state before its first write;
 * the synchronous commit then uses explicit remote IDs and call-carried
 * provenance on every participating store action.
 */
export function createGraphMutations(deps: GraphMutationsDeps): GraphMutations {
  const nodeStore = useNodeDataStore()
  const linkStore = useLinkStore()
  const linkPresentationStore = useLinkPresentationStore()
  const widgetStore = useWidgetValueStore()

  function fail(message: string): false {
    console.error(`[agent-crdt] graph mutation rejected: ${message}`)
    return false
  }

  function prepare(
    scope: GraphScope,
    queued: readonly QueuedMutation[]
  ): PreparedMutation[] | string {
    const draft = snapshotDraft(scope)
    const prepared: PreparedMutation[] = []
    for (const mutation of queued) {
      const result = prepareMutation(draft, mutation)
      if (typeof result === 'string') return result
      prepared.push(result)
    }
    return prepared
  }

  function snapshotDraft(scope: GraphScope): PrepareDraft {
    const nodes = new Map(
      nodeStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map((node) => [nodeKey(node.id), node])
    )
    const links = new Map(
      [...linkStore.graphTopologies(scope)].map((link) => [link.id, link])
    )
    const widgets = new Map<string, Set<string>>()
    for (const node of nodes.values()) {
      widgets.set(
        nodeKey(node.id),
        new Set(
          widgetStore
            .getNodeWidgets(scope.rootGraphId, node.id)
            .map((widget) => widget.name)
        )
      )
    }
    return { scope, nodes, links, widgets }
  }

  function prepareMutation(
    draft: PrepareDraft,
    mutation: QueuedMutation
  ): PreparedMutation | string {
    switch (mutation.kind) {
      case 'addNode':
      case 'reconcileNode':
        return prepareNodeMutation(draft, mutation)
      case 'reconcileNodeFields':
        return prepareNodeFields(draft, mutation)
      case 'setWidget':
        return prepareSetWidget(draft, mutation)
      case 'connect':
        return prepareConnect(draft, mutation)
      default:
        return prepareRemoval(draft, mutation)
    }
  }

  function prepareRemoval(
    draft: PrepareDraft,
    mutation: QueuedOf<
      'removeMissing' | 'removeLinks' | 'deleteNode' | 'clearSemanticGraph'
    >
  ): PreparedMutation | string {
    switch (mutation.kind) {
      case 'removeMissing':
        return prepareRemoveMissing(draft, mutation)
      case 'removeLinks':
        return prepareRemoveLinks(draft, mutation)
      case 'deleteNode':
        return prepareDeleteNode(draft, mutation)
      case 'clearSemanticGraph':
        return prepareClear(draft)
    }
  }

  function nodePayloadError(
    payload: SemanticNodePayload,
    message: string
  ): string | undefined {
    const { id, type } = payload
    const valid =
      (typeof id === 'string' || typeof id === 'number') &&
      typeof type === 'string' &&
      type.length > 0
    return valid ? undefined : message
  }

  function validateNodeUpsert(
    scope: GraphScope,
    node: PreparedNode,
    key: string
  ): string | undefined {
    const incumbent = nodeStore.getNode(scope.rootGraphId, node.state.id)
    if (incumbent && incumbent.graphId !== scope.owningGraphId) {
      return `node id ${key} belongs to graph ${incumbent.graphId}`
    }
    const invalidWidget = node.widgets.some(
      ({ name }) =>
        !isWidgetId(widgetId(scope.rootGraphId, node.state.id, name))
    )
    return invalidWidget ? `node ${key} has an invalid widget name` : undefined
  }

  function prepareNodeMutation(
    draft: PrepareDraft,
    mutation: QueuedOf<'addNode' | 'reconcileNode'>
  ): PreparedMutation | string {
    const payloadError = nodePayloadError(
      mutation.payload,
      'addNode requires a payload id and type'
    )
    if (payloadError) return payloadError
    const { scope, nodes, widgets } = draft
    const key = nodeKey(toNodeId(mutation.payload.id))
    const existing = nodes.get(key)
    const node = prepareNode(mutation.payload, scope, existing)
    bindReconciledNode(scope, node, mutation)
    const validationError = validateNodeUpsert(scope, node, key)
    if (validationError) return validationError
    if (mutation.kind === 'addNode' && nodes.has(key)) {
      return `node id ${key} is already registered`
    }
    nodes.set(key, node.state)
    widgets.set(key, new Set(node.widgets.map(({ name }) => name)))
    const replaced =
      mutation.kind === 'reconcileNode' &&
      existing !== undefined &&
      existing.type !== node.state.type
    return { kind: replaced ? 'replaceNode' : mutation.kind, node }
  }

  /**
   * A same-type field resync keeps the incumbent's slots; a missing node is
   * added and a type change replaces it from the full payload.
   */
  function prepareNodeFields(
    draft: PrepareDraft,
    mutation: QueuedOf<'reconcileNodeFields'>
  ): PreparedMutation | string {
    const payloadError = nodePayloadError(
      mutation.payload,
      'reconcileNodeFields requires a payload id and type'
    )
    if (payloadError) return payloadError
    const { scope, nodes, widgets } = draft
    const key = nodeKey(toNodeId(mutation.payload.id))
    const existing = nodes.get(key)
    const node = prepareNode(mutation.payload, scope, existing)
    if (existing?.type === node.state.type) {
      node.state.inputs = existing.inputs
      node.state.outputs = existing.outputs
      nodes.set(key, node.state)
      return { kind: mutation.kind, state: node.state }
    }
    const validationError = validateNodeUpsert(scope, node, key)
    if (validationError) return validationError
    nodes.set(key, node.state)
    widgets.set(key, new Set(node.widgets.map(({ name }) => name)))
    return { kind: existing ? 'replaceNode' : 'addNode', node }
  }

  function bindReconciledNode(
    scope: GraphScope,
    node: PreparedNode,
    mutation: QueuedOf<'addNode' | 'reconcileNode'>
  ): void {
    const incumbent = nodeStore.getNode(scope.rootGraphId, node.state.id)
    if (
      mutation.kind !== 'reconcileNode' ||
      !incumbent ||
      incumbent.type !== node.state.type
    )
      return
    const { title, widgets_values, widgets_values_named } = mutation.payload
    if (Array.isArray(widgets_values)) {
      bindWidgetsBySlot(scope, node, widgets_values_named)
    }
    if (typeof title !== 'string' || !title) node.state.title = incumbent.title
    node.state.inputs = reconcileInputSlots(
      { ...incumbent, inputs: incumbent.inputs.map((input) => ({ ...input })) },
      node.state
    )
  }

  /**
   * The incumbent's widget order is the authoritative slot binding: a slot
   * whose name the record carries takes the named value, every other slot
   * keeps its positional value.
   */
  function bindWidgetsBySlot(
    scope: GraphScope,
    node: PreparedNode,
    widgetsValuesNamed: unknown
  ): void {
    const serializable = widgetStore
      .getNodeWidgets(scope.rootGraphId, node.state.id)
      .filter(
        (widget) => widget.serialize !== false && widget.type !== 'button'
      )
    const named = isRecord(widgetsValuesNamed) ? widgetsValuesNamed : {}
    node.widgets.forEach((widget, index) => {
      const slot = serializable.at(index)
      if (!slot) return
      widget.name = slot.name
      if (!(slot.name in named)) return
      widget.value = structuredClone(named[slot.name]) as WidgetValue
      widget.type = widgetType(named[slot.name])
    })
  }

  function prepareSetWidget(
    draft: PrepareDraft,
    mutation: QueuedOf<'setWidget'>
  ): PreparedMutation | string {
    const { scope, nodes, widgets } = draft
    const key = nodeKey(mutation.nodeId)
    if (!nodes.has(key)) return `node ${key} does not exist`
    if (
      !isWidgetId(widgetId(scope.rootGraphId, mutation.nodeId, mutation.name))
    ) {
      return `node ${key} has an invalid widget name`
    }
    widgets.get(key)?.add(mutation.name)
    return {
      kind: mutation.kind,
      nodeId: mutation.nodeId,
      name: mutation.name,
      value: structuredClone(mutation.value) as WidgetValue
    }
  }

  function foreignLinkError(scope: GraphScope, id: LinkId): string | undefined {
    const incumbent = linkStore.getTopology(scope.rootGraphId, id)
    return incumbent && incumbent.graphId !== scope.owningGraphId
      ? `link id ${id} belongs to graph ${incumbent.graphId}`
      : undefined
  }

  function prepareConnect(
    draft: PrepareDraft,
    mutation: QueuedOf<'connect'>
  ): PreparedMutation | string {
    const { link } = mutation
    const wellFormed = [link.id, link.originSlot, link.targetSlot].every(
      (value) => Number.isInteger(value) && value >= 0
    )
    if (!wellFormed)
      return 'connect requires non-negative integer ids and slots'
    const { scope, nodes, links } = draft
    const topology = prepareTopology(link, scope)
    const foreign = foreignLinkError(scope, topology.id)
    if (foreign) return foreign
    const origin = nodes.get(nodeKey(topology.originNodeId))
    if (!origin) {
      return `connect origin node ${topology.originNodeId} does not exist`
    }
    const target = nodes.get(nodeKey(topology.targetNodeId))
    if (!target) {
      return `connect target node ${topology.targetNodeId} does not exist`
    }
    const slots = connectEndpointSlots(link, topology, origin, target)
    if (typeof slots === 'string') return slots
    applyDraftConnectSlots(nodes, link, topology, slots)
    replaceDraftLink(links, topology)
    return {
      kind: mutation.kind,
      topology,
      ...(link.originOutputs && { originOutputs: slots.originOutputs }),
      ...(link.targetInputs && { targetInputs: slots.targetInputs })
    }
  }

  function connectEndpointSlots(
    link: SemanticLinkPayload,
    topology: LinkTopology,
    origin: NodeState,
    target: NodeState
  ): ConnectSlots | string {
    const originOutputs = link.originOutputs
      ? prepareOutputSlots(link.originOutputs)
      : origin.outputs
    const targetInputs = link.targetInputs
      ? prepareInputSlots(link.targetInputs, target.inputs)
      : target.inputs
    if (topology.originSlot >= originOutputs.length) {
      return `connect origin slot ${topology.originSlot} does not exist`
    }
    if (topology.targetSlot >= targetInputs.length) {
      return `connect target slot ${topology.targetSlot} does not exist`
    }
    return { originOutputs, targetInputs }
  }

  /**
   * Supplied endpoint slots land in the draft so a later connect in the same
   * batch reads them back, including a self-link whose origin is its target.
   */
  function applyDraftConnectSlots(
    nodes: Map<string, NodeState>,
    link: SemanticLinkPayload,
    topology: LinkTopology,
    slots: ConnectSlots
  ): void {
    if (link.originOutputs) {
      const origin = nodes.get(nodeKey(topology.originNodeId))
      if (origin) {
        nodes.set(nodeKey(topology.originNodeId), {
          ...origin,
          outputs: slots.originOutputs
        })
      }
    }
    if (link.targetInputs) {
      const target = nodes.get(nodeKey(topology.targetNodeId))
      if (target) {
        nodes.set(nodeKey(topology.targetNodeId), {
          ...target,
          inputs: slots.targetInputs
        })
      }
    }
  }

  function replaceDraftLink(
    links: Map<LinkId, LinkTopology>,
    topology: LinkTopology
  ): void {
    links.delete(topology.id)
    for (const [id, incumbent] of links) {
      if (
        incumbent.targetNodeId === topology.targetNodeId &&
        incumbent.targetSlot === topology.targetSlot
      ) {
        links.delete(id)
      }
    }
    links.set(topology.id, topology)
  }

  function prepareRemoveMissing(
    draft: PrepareDraft,
    mutation: QueuedOf<'removeMissing'>
  ): PreparedMutation | string {
    const { nodes, links, widgets } = draft
    const retainedNodeIds = new Set(mutation.retainedNodeIds.map(nodeKey))
    const retainedLinkIds = new Set<LinkId>()
    for (const value of mutation.retainedLinkIds) {
      if (!Number.isInteger(value) || value < 0) {
        return 'removeMissing requires non-negative integer link ids'
      }
      retainedLinkIds.add(toLinkId(value))
    }
    const nodeIds = [...nodes.values()]
      .map(({ id }) => id)
      .filter((id) => !retainedNodeIds.has(nodeKey(id)))
    for (const id of nodeIds) {
      nodes.delete(nodeKey(id))
      widgets.delete(nodeKey(id))
      removeIncidentLinks(nodes, links, id)
    }
    const linkIds = [...links.keys()].filter((id) => !retainedLinkIds.has(id))
    for (const id of linkIds) removeSimulatedLink(nodes, links, id)
    return { kind: mutation.kind, nodeIds, linkIds }
  }

  function resolveOwnedLinkIds(
    scope: GraphScope,
    values: readonly number[],
    message: string
  ): LinkId[] | string {
    const linkIds: LinkId[] = []
    for (const value of values) {
      if (!Number.isInteger(value) || value < 0) return message
      const id = toLinkId(value)
      const foreign = foreignLinkError(scope, id)
      if (foreign) return foreign
      linkIds.push(id)
    }
    return linkIds
  }

  function prepareRemoveLinks(
    draft: PrepareDraft,
    mutation: QueuedOf<'removeLinks'>
  ): PreparedMutation | string {
    const linkIds = resolveOwnedLinkIds(
      draft.scope,
      mutation.linkIds,
      'removeLinks requires non-negative integer ids'
    )
    if (typeof linkIds === 'string') return linkIds
    for (const id of linkIds) {
      removeSimulatedLink(draft.nodes, draft.links, id)
    }
    return { kind: mutation.kind, linkIds }
  }

  function prepareDeleteNode(
    draft: PrepareDraft,
    mutation: QueuedOf<'deleteNode'>
  ): PreparedMutation | string {
    const { scope, nodes, links, widgets } = draft
    const incumbent = nodeStore.getNode(scope.rootGraphId, mutation.nodeId)
    if (incumbent && incumbent.graphId !== scope.owningGraphId) {
      return `node id ${mutation.nodeId} belongs to graph ${incumbent.graphId}`
    }
    const removedLinkIds = resolveOwnedLinkIds(
      scope,
      mutation.removedLinkIds,
      'deleteNode requires non-negative integer link ids'
    )
    if (typeof removedLinkIds === 'string') return removedLinkIds
    nodes.delete(nodeKey(mutation.nodeId))
    widgets.delete(nodeKey(mutation.nodeId))
    removeIncidentLinks(nodes, links, mutation.nodeId)
    for (const id of removedLinkIds) removeSimulatedLink(nodes, links, id)
    return { kind: mutation.kind, nodeId: mutation.nodeId, removedLinkIds }
  }

  function prepareClear(draft: PrepareDraft): PreparedMutation {
    const nodeIds = [...draft.nodes.values()].map(({ id }) => id)
    draft.nodes.clear()
    draft.widgets.clear()
    draft.links.clear()
    return { kind: 'clearSemanticGraph', nodeIds }
  }

  function detachLinkSlots(
    scope: GraphScope,
    topology: LinkTopology,
    context: RemoteMutationContext
  ): void {
    const nodes = nodeStore.getGraphNodesFor(
      scope.rootGraphId,
      scope.owningGraphId
    )
    for (const [nodeId, slots] of detachedLinkSlots(nodes, topology)) {
      nodeStore.updateNodeSlots(scope, nodeId, slots, context)
    }
  }

  function removeLink(
    scope: GraphScope,
    topology: LinkTopology,
    context: RemoteMutationContext
  ): void {
    detachLinkSlots(scope, topology, context)
    if (linkStore.deleteLink(scope, topology, context)) {
      linkPresentationStore.take(scope, topology.id)
    }
  }

  function deleteNode(
    scope: GraphScope,
    nodeId: NodeId,
    removedLinkIds: readonly LinkId[],
    context: RemoteMutationContext
  ): void {
    const node = nodeStore
      .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
      .find((candidate) => candidate.id === nodeId)
    const incident = [...linkStore.graphTopologies(scope)].filter(
      (topology) =>
        topology.originNodeId === nodeId ||
        topology.targetNodeId === nodeId ||
        removedLinkIds.includes(topology.id)
    )
    for (const topology of incident) {
      removeLink(scope, topology, context)
    }
    widgetStore.clearNode(scope.rootGraphId, nodeId, context)
    if (node) nodeStore.deleteNode(scope, node, context)
    deps.layout.deleteNodes(scope, [nodeId], context)
  }

  function commit(
    scope: GraphScope,
    prepared: readonly PreparedMutation[],
    context: RemoteMutationContext
  ): void {
    for (const mutation of prepared) commitMutation(scope, mutation, context)
  }

  function commitMutation(
    scope: GraphScope,
    mutation: PreparedMutation,
    context: RemoteMutationContext
  ): void {
    switch (mutation.kind) {
      case 'addNode':
      case 'reconcileNode':
      case 'replaceNode':
        commitNode(scope, mutation, context)
        break
      case 'reconcileNodeFields':
        nodeStore.updateNodeFields(
          scope,
          mutation.state.id,
          mutation.state,
          context
        )
        break
      case 'setWidget':
        commitSetWidget(scope, mutation, context)
        break
      case 'connect':
        commitConnect(scope, mutation, context)
        break
      default:
        commitRemoval(scope, mutation, context)
    }
  }

  function commitRemoval(
    scope: GraphScope,
    mutation: PreparedOf<
      'removeMissing' | 'removeLinks' | 'deleteNode' | 'clearSemanticGraph'
    >,
    context: RemoteMutationContext
  ): void {
    switch (mutation.kind) {
      case 'removeMissing':
        commitRemoveMissing(scope, mutation, context)
        break
      case 'removeLinks':
        commitRemoveLinks(scope, mutation.linkIds, context)
        break
      case 'deleteNode':
        deleteNode(scope, mutation.nodeId, mutation.removedLinkIds, context)
        break
      case 'clearSemanticGraph':
        commitClear(scope, mutation.nodeIds, context)
        break
    }
  }

  function commitNode(
    scope: GraphScope,
    mutation: PreparedOf<'addNode' | 'reconcileNode' | 'replaceNode'>,
    context: RemoteMutationContext
  ): void {
    const { state, widgets } = mutation.node
    let existing = nodeStore.getNode(scope.rootGraphId, state.id)
    if (mutation.kind === 'replaceNode' && existing) {
      deleteNode(scope, existing.id, [], context)
      existing = undefined
    }
    if (mutation.kind === 'reconcileNode' && existing) {
      reconcileExistingNode(scope, existing, mutation.node, context)
    } else {
      nodeStore.registerNode(scope, state, context)
    }
    registerPreparedWidgets(scope, mutation.kind, state, widgets, context)
    if (!existing) {
      deps.layout.createNode(scope, state.id, mutation.node.layout, context)
    }
  }

  function reconcileExistingNode(
    scope: GraphScope,
    existing: NodeState,
    node: PreparedNode,
    context: RemoteMutationContext
  ): void {
    const { state, widgets, widgetsAuthoritative } = node
    if (existing.type === state.type) {
      state.inputs = reconcileInputSlots(existing, state)
      if (!widgetsAuthoritative && state.lastSerialization) {
        overlayStaleSnapshot(scope, existing, state.id, state.lastSerialization)
      }
      nodeStore.updateNode(scope, state.id, state, context)
    } else {
      nodeStore.deleteNode(scope, existing, context)
      nodeStore.registerNode(scope, state, context)
      widgetStore.clearNode(scope.rootGraphId, state.id, context)
    }
    if (widgetsAuthoritative) pruneUnlistedWidgets(scope, state, widgets)
  }

  function pruneUnlistedWidgets(
    scope: GraphScope,
    state: NodeState,
    widgets: PreparedNode['widgets']
  ): void {
    const names = new Set([
      ...widgets.map(({ name }) => name),
      ...state.inputs
        .filter((input) => input.widgetId)
        .map((input) => input.name)
    ])
    for (const widget of widgetStore.getNodeWidgets(
      scope.rootGraphId,
      state.id
    )) {
      if (
        widget.serialize === false ||
        widget.type === 'button' ||
        names.has(widget.name)
      )
        continue
      widgetStore.deleteWidget(
        widgetId(scope.rootGraphId, state.id, widget.name)
      )
    }
  }

  /**
   * setWidget writes through to record-shaped values and the named record, but
   * a saved positional array and direct widget-store writes do not follow.
   * Overlay the live store values so a layout-only reconcile can't resurrect a
   * superseded value. Only widgets already present in the stale snapshot take
   * part, so a node with no prior snapshot (or one cleared to empty) stays
   * untouched.
   */
  function overlayStaleSnapshot(
    scope: GraphScope,
    existing: NodeState,
    nodeId: NodeId,
    serialised: ISerialisedNode
  ): void {
    const stale = staleWidgetOverlay(scope, existing, nodeId)
    setStoredWidgetValues(serialised, overlaidPositional(stale))
    serialised.widgets_values_named =
      stale.staleNamed === undefined ? stale.staleNamed : stale.named
  }

  function staleWidgetOverlay(
    scope: GraphScope,
    existing: NodeState,
    nodeId: NodeId
  ) {
    const staleNamed = cloneDeep(
      existing.lastSerialization?.widgets_values_named
    )
    const stalePositional = cloneDeep(
      storedWidgetValues(existing.lastSerialization)
    )
    const serializableWidgets = widgetStore
      .getNodeWidgets(scope.rootGraphId, nodeId)
      .filter(
        (widget) => widget.serialize !== false && widget.type !== 'button'
      )
    const namedKeys = Object.keys(staleNamed ?? {})
    const positionalNames = stalePositionalNames(
      namedKeys,
      stalePositional,
      serializableWidgets.map((widget) => widget.name)
    )
    // Names known from either the stale named snapshot or a record-shaped
    // stale positional value scope which widgets are eligible for the overlay.
    const staleNames = new Set([
      ...positionalNames,
      ...(isRecord(stalePositional) ? Object.keys(stalePositional) : [])
    ])
    const named = { ...staleNamed }
    const overlay: Record<string, WidgetValue> = {}
    for (const widget of serializableWidgets) {
      if (!staleNames.has(widget.name)) continue
      overlay[widget.name] = widget.value
      if (widget.name in named) named[widget.name] = widget.value
    }
    return {
      staleNamed,
      stalePositional,
      namedKeys,
      positionalNames,
      overlay,
      named
    }
  }

  /**
   * A positional-only snapshot carries no names: its slots follow the
   * serializable-widget order, like the positional remap in prepare. With a
   * named record the array is left as saved; the record carries the values.
   */
  function stalePositionalNames(
    namedKeys: string[],
    stalePositional: unknown,
    serializableNames: string[]
  ): string[] {
    return namedKeys.length > 0 || !Array.isArray(stalePositional)
      ? namedKeys
      : serializableNames
  }

  function overlaidPositional({
    stalePositional,
    namedKeys,
    positionalNames,
    overlay
  }: ReturnType<typeof staleWidgetOverlay>): StoredWidgetValues | undefined {
    if (Array.isArray(stalePositional)) {
      if (namedKeys.length > 0) return stalePositional
      return stalePositional.map((value, index) => {
        const name = positionalNames[index]
        return name && name in overlay ? overlay[name] : value
      })
    }
    if (isRecord(stalePositional)) return { ...stalePositional, ...overlay }
    return stalePositional
  }

  function registerPreparedWidgets(
    scope: GraphScope,
    kind: PreparedMutation['kind'],
    state: NodeState,
    widgets: PreparedNode['widgets'],
    context: RemoteMutationContext
  ): void {
    for (const widget of widgets) {
      const id = widgetId(scope.rootGraphId, state.id, widget.name)
      if (
        kind === 'reconcileNode' &&
        widgetStore.setValue(id, widget.value, context)
      )
        continue
      widgetStore.registerWidget(
        id,
        {
          name: widget.name,
          type: widget.type,
          value: widget.value,
          options: {},
          label: widget.name
        },
        {},
        undefined,
        context
      )
    }
  }

  function commitSetWidget(
    scope: GraphScope,
    mutation: PreparedOf<'setWidget'>,
    context: RemoteMutationContext
  ): void {
    const id = widgetId(scope.rootGraphId, mutation.nodeId, mutation.name)
    if (!widgetStore.getWidget(id)) {
      widgetStore.registerWidget(
        id,
        {
          name: mutation.name,
          type: widgetType(mutation.value),
          value: mutation.value,
          options: {},
          label: mutation.name
        },
        {},
        undefined,
        context
      )
    } else {
      widgetStore.setValue(id, mutation.value, context)
    }
    const node = nodeStore.getNode(scope.rootGraphId, mutation.nodeId)
    if (node) syncSerializedWidgetValue(node, mutation.name, mutation.value)
  }

  function commitConnect(
    scope: GraphScope,
    mutation: PreparedOf<'connect'>,
    context: RemoteMutationContext
  ): void {
    const existing = linkStore.getTopology(
      scope.rootGraphId,
      mutation.topology.id
    )
    const presentation = existing
      ? linkPresentationStore.getPresentation(scope, existing.id)
      : undefined
    if (existing) removeLink(scope, existing, context)
    const occupant = linkStore.getInputSlotLink(
      scope,
      mutation.topology.targetNodeId,
      mutation.topology.targetSlot
    )
    const replacement = linkStore.replaceLink(
      scope,
      occupant,
      mutation.topology,
      context
    )
    if (!replacement) return
    if (occupant) {
      detachLinkSlots(scope, occupant, context)
      linkPresentationStore.take(scope, occupant.id)
    }
    if (presentation) {
      linkPresentationStore.patch(scope, replacement.id, presentation)
    }
    applyConnectSlots(scope, mutation, context)
  }

  function applyConnectSlots(
    scope: GraphScope,
    mutation: PreparedOf<'connect'>,
    context: RemoteMutationContext
  ): void {
    const endpointNodes = new Map(
      nodeStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map((node) => [nodeKey(node.id), node])
    )
    const origin = endpointNodes.get(nodeKey(mutation.topology.originNodeId))
    const target = endpointNodes.get(nodeKey(mutation.topology.targetNodeId))
    if (origin && mutation.originOutputs) {
      nodeStore.updateNodeSlots(
        scope,
        origin.id,
        { inputs: origin.inputs, outputs: mutation.originOutputs },
        context
      )
    }
    if (target && mutation.targetInputs) {
      nodeStore.updateNodeSlots(
        scope,
        target.id,
        {
          inputs: reconcileInputSlots(target, {
            inputs: mutation.targetInputs,
            properties: target.properties
          }),
          outputs: target.outputs
        },
        context
      )
    }
  }

  function commitRemoveLinks(
    scope: GraphScope,
    linkIds: readonly LinkId[],
    context: RemoteMutationContext
  ): void {
    for (const id of linkIds) {
      const topology = linkStore.getTopology(scope.rootGraphId, id)
      if (topology) removeLink(scope, topology, context)
    }
  }

  function commitRemoveMissing(
    scope: GraphScope,
    mutation: PreparedOf<'removeMissing'>,
    context: RemoteMutationContext
  ): void {
    commitRemoveLinks(scope, mutation.linkIds, context)
    for (const id of mutation.nodeIds) deleteNode(scope, id, [], context)
  }

  function commitClear(
    scope: GraphScope,
    nodeIds: readonly NodeId[],
    context: RemoteMutationContext
  ): void {
    for (const nodeId of nodeIds) {
      widgetStore.clearNode(scope.rootGraphId, nodeId, context)
    }
    deps.layout.deleteNodes(scope, nodeIds, context)
    linkStore.clearOwner(scope, context)
    linkPresentationStore.clearOwner(scope)
    nodeStore.clearOwner(scope, context)
  }

  const graphMutations: GraphMutations = {
    batch(context, define) {
      const scope = deps.getScope()
      if (!scope) return false
      const queued: QueuedMutation[] = []
      define({
        addNode(payload) {
          queued.push({ kind: 'addNode', payload })
        },
        reconcileNode(payload) {
          queued.push({ kind: 'reconcileNode', payload })
        },
        reconcileNodeFields(payload) {
          queued.push({ kind: 'reconcileNodeFields', payload })
        },
        setWidget(nodeId, name, value) {
          queued.push({ kind: 'setWidget', nodeId, name, value })
        },
        connect(link) {
          queued.push({ kind: 'connect', link })
        },
        removeMissing(retainedNodeIds, retainedLinkIds) {
          queued.push({
            kind: 'removeMissing',
            retainedNodeIds,
            retainedLinkIds
          })
        },
        removeLinks(linkIds) {
          queued.push({ kind: 'removeLinks', linkIds })
        },
        deleteNode(nodeId, removedLinkIds = []) {
          queued.push({ kind: 'deleteNode', nodeId, removedLinkIds })
        },
        clearSemanticGraph() {
          queued.push({ kind: 'clearSemanticGraph' })
        }
      })
      const prepared = prepare(scope, queued)
      if (typeof prepared === 'string') return fail(prepared)
      commit(scope, prepared, context)
      return true
    },
    addNode(payload, context) {
      return graphMutations.batch(context, (batch) => batch.addNode(payload))
    },
    setWidget(nodeId, name, value, context) {
      return graphMutations.batch(context, (batch) =>
        batch.setWidget(nodeId, name, value)
      )
    },
    connect(link, context) {
      return graphMutations.batch(context, (batch) => batch.connect(link))
    },
    deleteNode(nodeId, removedLinkIds, context) {
      return graphMutations.batch(context, (batch) =>
        batch.deleteNode(nodeId, removedLinkIds)
      )
    },
    clearSemanticGraph(context) {
      return graphMutations.batch(context, (batch) =>
        batch.clearSemanticGraph()
      )
    }
  }

  return graphMutations
}
