import type {
  ISerialisableNodeInput,
  ISerialisableNodeOutput,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
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
}

type PreparedMutation =
  | { kind: 'addNode'; node: PreparedNode }
  | { kind: 'reconcileNode'; node: PreparedNode }
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

function prepareInputSlots(value: unknown): NodeState['inputs'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((raw) => {
    const slot = structuredClone(raw)
    if (typeof slot.link === 'number') slot.link = toLinkId(slot.link)
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

function hasTitle(
  payload: SemanticNodePayload
): payload is SemanticNodePayload & { title: string } {
  return typeof payload.title === 'string'
}

function prepareNode(
  payload: SemanticNodePayload,
  scope: GraphScope
): PreparedNode {
  const id = toNodeId(payload.id)
  const [x, y] = readPair(payload.pos, [0, 0])
  const [width, height] = readPair(payload.size, [270, 100])
  const mode = Number(payload.mode)
  const state: NodeState = {
    id,
    graphId: scope.owningGraphId,
    type: payload.type,
    title: hasTitle(payload) ? payload.title : payload.type,
    flags: cloneRecord(payload.flags),
    inputs: prepareInputSlots(payload.inputs),
    outputs: prepareOutputSlots(payload.outputs),
    mode: Number.isInteger(mode) ? mode : 0,
    properties: cloneRecord(payload.properties) as NodeState['properties'],
    lastSerialization: structuredClone(payload) as unknown as ISerialisedNode,
    ...(typeof payload.bgcolor === 'string' && { bgcolor: payload.bgcolor }),
    ...(typeof payload.boxcolor === 'string' && { boxcolor: payload.boxcolor }),
    ...(typeof payload.color === 'string' && { color: payload.color }),
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
  return {
    state,
    widgets: widgetEntries(payload),
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

function removeIncidentLinks(
  links: Map<LinkId, LinkTopology>,
  nodeId: NodeId
): void {
  for (const [id, topology] of links) {
    if (topology.originNodeId === nodeId || topology.targetNodeId === nodeId) {
      links.delete(id)
    }
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
          const node = prepareNode(mutation.payload, scope)
          const key = nodeKey(node.state.id)
          const registered = nodeStore.getNode(scope.rootGraphId, node.state.id)
          if (registered && registered.graphId !== scope.owningGraphId) {
            return `node id ${key} belongs to graph ${registered.graphId}`
          }
          const incumbent = nodes.get(key)
          // A reconcile payload without a title leaves the title unspecified;
          // it does not rename the node to its type. The incumbent's title
          // may have come from the node class (`configure()` falls back to
          // the constructor's static title) rather than from any payload.
          if (
            mutation.kind === 'reconcileNode' &&
            incumbent &&
            !hasTitle(mutation.payload)
          ) {
            node.state.title = incumbent.title
            if (node.state.lastSerialization) {
              node.state.lastSerialization.title = incumbent.title
            }
          }
          if (mutation.kind === 'addNode' && nodes.has(key)) {
            return `node id ${key} is already registered`
          }
          if (
            node.widgets.some(
              ({ name }) =>
                !isWidgetId(widgetId(scope.rootGraphId, node.state.id, name))
            )
          ) {
            return `node ${key} has an invalid widget name`
          }
          nodes.set(key, node.state)
          widgets.set(key, new Set(node.widgets.map(({ name }) => name)))
          prepared.push({ kind: mutation.kind, node })
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
          widgets.get(key)?.add(mutation.name)
          prepared.push({
            kind: mutation.kind,
            nodeId: mutation.nodeId,
            name: mutation.name,
            value: structuredClone(mutation.value) as WidgetValue
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
            ? prepareInputSlots(mutation.link.targetInputs)
            : target.inputs
          if (topology.originSlot >= originOutputs.length) {
            return `connect origin slot ${topology.originSlot} does not exist`
          }
          if (topology.targetSlot >= targetInputs.length) {
            return `connect target slot ${topology.targetSlot} does not exist`
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
            widgets.delete(nodeKey(id))
            removeIncidentLinks(links, id)
          }
          const linkIds = [...links.keys()].filter(
            (id) => !retainedLinkIds.has(id)
          )
          for (const id of linkIds) links.delete(id)
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
            links.delete(id)
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
          widgets.delete(nodeKey(mutation.nodeId))
          removeIncidentLinks(links, mutation.nodeId)
          for (const id of removedLinkIds) links.delete(id)
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
          widgets.clear()
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
    const nodes = new Map(
      nodeStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map((node) => [nodeKey(node.id), node])
    )
    const changed = new Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>>()
    const slotsFor = (node: NodeState) => {
      const prior = changed.get(node.id)
      if (prior) return prior
      const slots = { inputs: node.inputs, outputs: node.outputs }
      changed.set(node.id, slots)
      return slots
    }

    const origin = nodes.get(nodeKey(topology.originNodeId))
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

    const target = nodes.get(nodeKey(topology.targetNodeId))
    if (target?.inputs[topology.targetSlot]?.link === topology.id) {
      const slots = slotsFor(target)
      slots.inputs = slots.inputs.map((input, index) =>
        index === topology.targetSlot ? { ...input, link: null } : input
      )
    }

    for (const [nodeId, slots] of changed) {
      nodeStore.updateNodeSlots(scope, nodeId, slots, context)
    }
  }

  function removeLink(
    scope: GraphScope,
    topology: LinkTopology,
    context: RemoteMutationContext
  ): void {
    detachLinkSlots(scope, topology, context)
    linkStore.deleteLink(scope, topology, context)
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
    for (const mutation of prepared) {
      switch (mutation.kind) {
        case 'addNode':
        case 'reconcileNode': {
          const existing = nodeStore.getNode(
            scope.rootGraphId,
            mutation.node.state.id
          )
          if (mutation.kind === 'reconcileNode' && existing) {
            nodeStore.updateNode(
              scope,
              mutation.node.state.id,
              mutation.node.state,
              context
            )
            widgetStore.clearNode(
              scope.rootGraphId,
              mutation.node.state.id,
              context
            )
          } else {
            nodeStore.registerNode(scope, mutation.node.state, context)
          }
          for (const widget of mutation.node.widgets) {
            widgetStore.registerWidget(
              widgetId(scope.rootGraphId, mutation.node.state.id, widget.name),
              {
                name: widget.name,
                type: widget.type,
                value: widget.value,
                options: {},
                label: widget.name
              },
              {},
              context
            )
          }
          if (!existing) {
            deps.layout.createNode(
              scope,
              mutation.node.state.id,
              mutation.node.layout,
              context
            )
          }
          break
        }
        case 'setWidget': {
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
              context
            )
          } else {
            widgetStore.setValue(id, mutation.value, context)
          }
          break
        }
        case 'connect': {
          const existing = linkStore.getTopology(
            scope.rootGraphId,
            mutation.topology.id
          )
          if (existing) removeLink(scope, existing, context)
          const occupant = linkStore.getInputSlotLink(
            scope,
            mutation.topology.targetNodeId,
            mutation.topology.targetSlot
          )
          linkStore.replaceLink(scope, occupant, mutation.topology, context)
          if (occupant) detachLinkSlots(scope, occupant, context)

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
