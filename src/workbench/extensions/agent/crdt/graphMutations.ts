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

import type { PlaceholderWidget, WidgetValuePayload } from './nodePayload'
import {
  cloneWidgetValue,
  nodeTitle,
  parseWidgetValues,
  placeholderWidgets,
  widgetType
} from './nodePayload'

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

type LiveWidgetMutationResult =
  | { status: 'skipped' }
  | { status: 'applied'; resolvedValue: WidgetValue }
  | { status: 'rolledBack'; resolvedValue: WidgetValue }

/**
 * Renderer-owned live widget port. A value patch for a widget that is already
 * mounted on the canvas is replayed through the live widget so its callback,
 * backing property, and rendered state move in the same frame; the port
 * reports the value the live widget settled on, or `skipped` when the node or
 * widget is not live.
 */
interface SemanticLiveWidgetMutationPort {
  setValue(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue,
    context: RemoteMutationContext
  ): LiveWidgetMutationResult
  rebind?(scope: GraphScope, nodeId: NodeId, name: string): void
}

interface GraphMutationBatch {
  addNode(payload: SemanticNodePayload): void
  /**
   * For a node of the same type, resyncs fields and slots and patches widget
   * values onto the registered widgets. A missing node or type mismatch is
   * added or replaced from the full payload.
   */
  reconcileNode(payload: SemanticNodePayload): void
  /** Like `reconcileNode`, but the live node keeps its slot list. */
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
  liveWidgets?: SemanticLiveWidgetMutationPort
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
  widgets: WidgetValuePayload
}

type PreparedMutation =
  | { kind: 'addNode'; node: PreparedNode }
  | { kind: 'reconcileNode'; node: PreparedNode }
  | { kind: 'replaceNode'; node: PreparedNode }
  | {
      kind: 'reconcileNodeFields'
      state: NodeState
      widgets: WidgetValuePayload
    }
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
function applySlotLink(
  slot: Record<string, unknown>,
  index: number,
  existing?: NodeState['inputs']
): void {
  if (typeof slot.link === 'number') {
    slot.link = toLinkId(slot.link)
    return
  }
  if (slot.link === undefined) slot.link = existing?.[index]?.link ?? null
}

/**
 * The CRDT payload never carries the autogrow-computed display name, so a
 * prior slot at the same index and name (i.e. this is a reconcile of a slot
 * the live node already has, not a genuinely new one) keeps its display
 * metadata instead of losing it to the thin payload.
 */
function preserveSlotDisplayMetadata(
  slot: Record<string, unknown>,
  priorSlot?: NodeState['inputs'][number]
): void {
  if (!priorSlot || priorSlot.name !== slot.name) return
  if (slot.localized_name === undefined)
    slot.localized_name = priorSlot.localized_name
  if (slot.label === undefined) slot.label = priorSlot.label
}

function prepareInputSlot(
  raw: Record<string, unknown>,
  index: number,
  existing?: NodeState['inputs']
): NodeState['inputs'][number] {
  const slot = structuredClone(raw)
  applySlotLink(slot, index, existing)
  preserveSlotDisplayMetadata(slot, existing?.[index])
  return {
    ...slot,
    boundingRect: [0, 0, 0, 0]
  } as unknown as NodeState['inputs'][number]
}

function prepareInputSlots(
  value: unknown,
  existing?: NodeState['inputs']
): NodeState['inputs'] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((raw, index) => prepareInputSlot(raw, index, existing))
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

type NodeColors = Pick<NodeState, 'bgcolor' | 'boxcolor' | 'color'>

function resolveColorField(
  value: unknown,
  existing?: string
): string | undefined {
  return typeof value === 'string' ? value : existing
}

/**
 * Node color is a client-only presentation property the CRDT document never
 * carries (see ComfyNode's constructor), so a payload without it keeps the
 * live node's color instead of losing it to a reconcile.
 */
function resolveNodeColors(
  payload: SemanticNodePayload,
  existing?: NodeState
): Partial<NodeColors> {
  const bgcolor = resolveColorField(payload.bgcolor, existing?.bgcolor)
  const boxcolor = resolveColorField(payload.boxcolor, existing?.boxcolor)
  const color = resolveColorField(payload.color, existing?.color)
  return {
    ...(bgcolor !== undefined && { bgcolor }),
    ...(boxcolor !== undefined && { boxcolor }),
    ...(color !== undefined && { color })
  }
}

type NodeDisplayFlags = Pick<NodeState, 'resizable' | 'shape' | 'showAdvanced'>

function resolveNodeDisplayFlags(
  payload: SemanticNodePayload
): Partial<NodeDisplayFlags> {
  return {
    ...(typeof payload.resizable === 'boolean' && {
      resizable: payload.resizable
    }),
    ...(typeof payload.shape === 'number' && {
      shape: payload.shape
    }),
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
  const incumbent = existing?.type === payload.type ? existing : undefined
  const id = toNodeId(payload.id)
  const [x, y] = readPair(payload.pos, [0, 0])
  const [width, height] = readPair(payload.size, [270, 100])
  const mode = Number(payload.mode)
  const state: NodeState = {
    id,
    graphId: scope.owningGraphId,
    type: payload.type,
    title: nodeTitle(payload.title, payload.type),
    flags: cloneRecord(payload.flags),
    inputs: prepareInputSlots(payload.inputs, incumbent?.inputs),
    outputs: prepareOutputSlots(payload.outputs),
    mode: Number.isInteger(mode) ? mode : 0,
    properties: cloneRecord(payload.properties) as NodeState['properties'],
    lastSerialization: structuredClone(payload) as unknown as ISerialisedNode,
    ...resolveNodeColors(payload, incumbent),
    ...resolveNodeDisplayFlags(payload)
  }
  return {
    state,
    widgets: parseWidgetValues(payload.widgets_values),
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
    const nodes = new Map(
      nodeStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map((node) => [nodeKey(node.id), node])
    )
    const links = new Map(
      [...linkStore.graphTopologies(scope)].map((link) => [link.id, link])
    )
    const validateNodeUpsert = (
      node: PreparedNode,
      key: string
    ): string | undefined => {
      const incumbent = nodeStore.getNode(scope.rootGraphId, node.state.id)
      if (incumbent && incumbent.graphId !== scope.owningGraphId) {
        return `node id ${key} belongs to graph ${incumbent.graphId}`
      }
      if (
        node.widgets.kind === 'named' &&
        [...node.widgets.values.keys()].some(
          (name) =>
            !isWidgetId(widgetId(scope.rootGraphId, node.state.id, name))
        )
      ) {
        return `node ${key} has an invalid widget name`
      }
    }

    const prepared: PreparedMutation[] = []
    for (const mutation of queued) {
      switch (mutation.kind) {
        case 'addNode':
        case 'reconcileNode': {
          if (
            (typeof mutation.payload.id !== 'string' &&
              typeof mutation.payload.id !== 'number') ||
            typeof mutation.payload.type !== 'string' ||
            mutation.payload.type.length === 0
          ) {
            return 'addNode requires a payload id and type'
          }
          const node = prepareNode(
            mutation.payload,
            scope,
            nodes.get(nodeKey(toNodeId(mutation.payload.id)))
          )
          const key = nodeKey(node.state.id)
          const existing = nodes.get(key)
          const validationError = validateNodeUpsert(node, key)
          if (validationError) return validationError
          if (mutation.kind === 'addNode' && nodes.has(key)) {
            return `node id ${key} is already registered`
          }
          nodes.set(key, node.state)
          prepared.push({
            kind:
              mutation.kind === 'reconcileNode' &&
              existing &&
              existing.type !== node.state.type
                ? 'replaceNode'
                : mutation.kind,
            node
          })
          break
        }
        case 'reconcileNodeFields': {
          if (
            (typeof mutation.payload.id !== 'string' &&
              typeof mutation.payload.id !== 'number') ||
            typeof mutation.payload.type !== 'string' ||
            mutation.payload.type.length === 0
          ) {
            return 'reconcileNodeFields requires a payload id and type'
          }
          const key = nodeKey(toNodeId(mutation.payload.id))
          const existing = nodes.get(key)
          const node = prepareNode(mutation.payload, scope, existing)
          if (!existing || existing.type !== node.state.type) {
            const validationError = validateNodeUpsert(node, key)
            if (validationError) return validationError
            nodes.set(key, node.state)
            prepared.push({
              kind: existing ? 'replaceNode' : 'addNode',
              node
            })
          } else {
            node.state.inputs = existing.inputs
            node.state.outputs = existing.outputs
            nodes.set(key, node.state)
            prepared.push({
              kind: mutation.kind,
              state: node.state,
              widgets: node.widgets
            })
          }
          break
        }
        case 'setWidget': {
          const key = nodeKey(mutation.nodeId)
          if (!nodes.has(key)) return `node ${key} does not exist`
          if (
            !isWidgetId(
              widgetId(scope.rootGraphId, mutation.nodeId, mutation.name)
            )
          ) {
            return `node ${key} has an invalid widget name`
          }
          prepared.push({
            kind: mutation.kind,
            nodeId: mutation.nodeId,
            name: mutation.name,
            value: cloneWidgetValue(mutation.value)
          })
          break
        }
        case 'connect': {
          if (
            !Number.isInteger(mutation.link.id) ||
            mutation.link.id < 0 ||
            !Number.isInteger(mutation.link.originSlot) ||
            mutation.link.originSlot < 0 ||
            !Number.isInteger(mutation.link.targetSlot) ||
            mutation.link.targetSlot < 0
          ) {
            return 'connect requires non-negative integer ids and slots'
          }
          const topology = prepareTopology(mutation.link, scope)
          const incumbent = linkStore.getTopology(
            scope.rootGraphId,
            topology.id
          )
          if (incumbent && incumbent.graphId !== scope.owningGraphId) {
            return `link id ${topology.id} belongs to graph ${incumbent.graphId}`
          }
          const origin = nodes.get(nodeKey(topology.originNodeId))
          if (!origin) {
            return `connect origin node ${topology.originNodeId} does not exist`
          }
          const target = nodes.get(nodeKey(topology.targetNodeId))
          if (!target) {
            return `connect target node ${topology.targetNodeId} does not exist`
          }
          const originOutputs = mutation.link.originOutputs
            ? prepareOutputSlots(mutation.link.originOutputs)
            : origin.outputs
          const targetInputs = mutation.link.targetInputs
            ? prepareInputSlots(mutation.link.targetInputs, target.inputs)
            : target.inputs
          if (topology.originSlot >= originOutputs.length) {
            return `connect origin slot ${topology.originSlot} does not exist`
          }
          if (topology.targetSlot >= targetInputs.length) {
            return `connect target slot ${topology.targetSlot} does not exist`
          }
          if (mutation.link.originOutputs) {
            nodes.set(nodeKey(topology.originNodeId), {
              ...origin,
              outputs: originOutputs
            })
          }
          if (mutation.link.targetInputs) {
            const currentTarget =
              nodes.get(nodeKey(topology.targetNodeId)) ?? target
            nodes.set(nodeKey(topology.targetNodeId), {
              ...currentTarget,
              inputs: targetInputs
            })
          }
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
          prepared.push({
            kind: mutation.kind,
            topology,
            ...(mutation.link.originOutputs && {
              originOutputs
            }),
            ...(mutation.link.targetInputs && {
              targetInputs
            })
          })
          break
        }
        case 'removeMissing': {
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
            removeIncidentLinks(nodes, links, id)
          }
          const linkIds = [...links.keys()].filter(
            (id) => !retainedLinkIds.has(id)
          )
          for (const id of linkIds) removeSimulatedLink(nodes, links, id)
          prepared.push({ kind: mutation.kind, nodeIds, linkIds })
          break
        }
        case 'removeLinks': {
          const linkIds: LinkId[] = []
          for (const value of mutation.linkIds) {
            if (!Number.isInteger(value) || value < 0) {
              return 'removeLinks requires non-negative integer ids'
            }
            const id = toLinkId(value)
            const incumbent = linkStore.getTopology(scope.rootGraphId, id)
            if (incumbent && incumbent.graphId !== scope.owningGraphId) {
              return `link id ${id} belongs to graph ${incumbent.graphId}`
            }
            removeSimulatedLink(nodes, links, id)
            linkIds.push(id)
          }
          prepared.push({
            kind: mutation.kind,
            linkIds
          })
          break
        }
        case 'deleteNode': {
          const incumbent = nodeStore.getNode(
            scope.rootGraphId,
            mutation.nodeId
          )
          if (incumbent && incumbent.graphId !== scope.owningGraphId) {
            return `node id ${mutation.nodeId} belongs to graph ${incumbent.graphId}`
          }
          const removedLinkIds: LinkId[] = []
          for (const value of mutation.removedLinkIds) {
            if (!Number.isInteger(value) || value < 0) {
              return 'deleteNode requires non-negative integer link ids'
            }
            const id = toLinkId(value)
            const link = linkStore.getTopology(scope.rootGraphId, id)
            if (link && link.graphId !== scope.owningGraphId) {
              return `link id ${id} belongs to graph ${link.graphId}`
            }
            removedLinkIds.push(id)
          }
          nodes.delete(nodeKey(mutation.nodeId))
          removeIncidentLinks(nodes, links, mutation.nodeId)
          for (const id of removedLinkIds) {
            removeSimulatedLink(nodes, links, id)
          }
          prepared.push({
            kind: mutation.kind,
            nodeId: mutation.nodeId,
            removedLinkIds
          })
          break
        }
        case 'clearSemanticGraph': {
          const nodeIds = [...nodes.values()].map(({ id }) => id)
          nodes.clear()
          links.clear()
          prepared.push({ kind: mutation.kind, nodeIds })
          break
        }
      }
    }
    return prepared
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

  /**
   * Replays the value through the live widget first so its callback and
   * backing property run in the same frame the semantic state is written, and
   * reports the value the live widget settled on. A node or widget that is not
   * live is `skipped` and keeps the incoming value.
   */
  function projectLiveWidgetValue(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue,
    context: RemoteMutationContext
  ): WidgetValue {
    const projected = deps.liveWidgets?.setValue(
      scope,
      nodeId,
      name,
      value,
      context
    )
    return projected && projected.status !== 'skipped'
      ? projected.resolvedValue
      : value
  }

  function registerPlaceholder(
    scope: GraphScope,
    nodeId: NodeId,
    widget: PlaceholderWidget,
    context: RemoteMutationContext
  ): void {
    const value = projectLiveWidgetValue(
      scope,
      nodeId,
      widget.name,
      widget.value,
      context
    )
    widgetStore.registerWidget(
      widgetId(scope.rootGraphId, nodeId, widget.name),
      {
        name: widget.name,
        type: widget.type,
        value,
        options: {},
        label: widget.name
      },
      {},
      undefined,
      context
    )
    // The registered state is a new identity, so a live widget that was
    // already mounted has to adopt it instead of keeping its own shim.
    deps.liveWidgets?.rebind?.(scope, nodeId, widget.name)
  }

  function setWidgetValue(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue,
    context: RemoteMutationContext
  ): void {
    const id = widgetId(scope.rootGraphId, nodeId, name)
    if (widgetStore.getWidget(id)) {
      widgetStore.setValue(
        id,
        projectLiveWidgetValue(scope, nodeId, name, value, context),
        context
      )
    } else {
      registerPlaceholder(
        scope,
        nodeId,
        { name, value, type: widgetType(value) },
        context
      )
    }
  }

  /**
   * A doc entry for a node that is already live is a value patch: the live
   * widgets keep their registered type, options, and state identity, and a
   * value the payload omits keeps its current value. Positional values bind
   * to the serialized widgets in order, the same order `LGraphNode.serialize`
   * wrote them in.
   */
  function applyWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    widgets: WidgetValuePayload,
    context: RemoteMutationContext
  ): void {
    switch (widgets.kind) {
      case 'omitted':
        return
      case 'named':
        for (const [name, value] of widgets.values) {
          setWidgetValue(scope, nodeId, name, value, context)
        }
        return
      case 'positional': {
        const serialized = widgetStore
          .getNodeWidgets(scope.rootGraphId, nodeId)
          .filter((widget) => widget.serialize !== false)
          .slice(0, widgets.values.length)
        for (const [index, widget] of serialized.entries()) {
          setWidgetValue(
            scope,
            nodeId,
            widget.name,
            widgets.values[index],
            context
          )
        }
        return
      }
      default: {
        const unhandled: never = widgets
        return unhandled
      }
    }
  }

  function commit(
    scope: GraphScope,
    prepared: readonly PreparedMutation[],
    context: RemoteMutationContext
  ): void {
    for (const mutation of prepared) {
      switch (mutation.kind) {
        case 'addNode':
        case 'reconcileNode':
        case 'replaceNode': {
          let existing = nodeStore.getNode(
            scope.rootGraphId,
            mutation.node.state.id
          )
          if (mutation.kind === 'replaceNode' && existing) {
            deleteNode(scope, existing.id, [], context)
            existing = undefined
          }
          if (mutation.kind === 'reconcileNode' && existing) {
            nodeStore.updateNode(
              scope,
              mutation.node.state.id,
              mutation.node.state,
              context
            )
            applyWidgetValues(
              scope,
              mutation.node.state.id,
              mutation.node.widgets,
              context
            )
            break
          }
          nodeStore.registerNode(scope, mutation.node.state, context)
          for (const widget of placeholderWidgets(mutation.node.widgets)) {
            registerPlaceholder(scope, mutation.node.state.id, widget, context)
          }
          deps.layout.createNode(
            scope,
            mutation.node.state.id,
            mutation.node.layout,
            context
          )
          break
        }
        case 'reconcileNodeFields': {
          nodeStore.updateNodeFields(
            scope,
            mutation.state.id,
            mutation.state,
            context
          )
          applyWidgetValues(scope, mutation.state.id, mutation.widgets, context)
          break
        }
        case 'setWidget': {
          setWidgetValue(
            scope,
            mutation.nodeId,
            mutation.name,
            mutation.value,
            context
          )
          break
        }
        case 'connect': {
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
          if (!replacement) break
          if (occupant) {
            detachLinkSlots(scope, occupant, context)
            linkPresentationStore.take(scope, occupant.id)
          }
          if (presentation) {
            linkPresentationStore.patch(scope, replacement.id, presentation)
          }

          const endpointNodes = new Map(
            nodeStore
              .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
              .map((node) => [nodeKey(node.id), node])
          )
          const origin = endpointNodes.get(
            nodeKey(mutation.topology.originNodeId)
          )
          const target = endpointNodes.get(
            nodeKey(mutation.topology.targetNodeId)
          )
          if (origin && mutation.originOutputs) {
            nodeStore.updateNodeSlots(
              scope,
              origin.id,
              {
                inputs: origin.inputs,
                outputs: mutation.originOutputs
              },
              context
            )
          }
          if (target && mutation.targetInputs) {
            nodeStore.updateNodeSlots(
              scope,
              target.id,
              {
                inputs: mutation.targetInputs,
                outputs: target.outputs
              },
              context
            )
          }
          break
        }
        case 'removeMissing':
          for (const id of mutation.linkIds) {
            const topology = linkStore.getTopology(scope.rootGraphId, id)
            if (topology) removeLink(scope, topology, context)
          }
          for (const id of mutation.nodeIds) deleteNode(scope, id, [], context)
          break
        case 'removeLinks':
          for (const id of mutation.linkIds) {
            const topology = linkStore.getTopology(scope.rootGraphId, id)
            if (topology) removeLink(scope, topology, context)
          }
          break
        case 'deleteNode':
          deleteNode(scope, mutation.nodeId, mutation.removedLinkIds, context)
          break
        case 'clearSemanticGraph':
          for (const nodeId of mutation.nodeIds) {
            widgetStore.clearNode(scope.rootGraphId, nodeId, context)
          }
          deps.layout.deleteNodes(scope, mutation.nodeIds, context)
          linkStore.clearOwner(scope, context)
          linkPresentationStore.clearOwner(scope)
          nodeStore.clearOwner(scope, context)
          break
      }
    }
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
