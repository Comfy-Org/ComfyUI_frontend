import { isPlainObject } from 'es-toolkit'
import { isEqual } from 'es-toolkit/compat'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot
} from '@/lib/litegraph/src/interfaces'
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

import type { PlacementRect } from './batchPlacement'
import { placementOffset } from './batchPlacement'
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

function isSlotRecord(value: unknown): value is { name?: unknown } {
  return value !== null && typeof value === 'object'
}

/**
 * Copies a serialized slot's fields onto the live slot object so the node
 * keeps its slot identity; an omitted field keeps the live value. A plain
 * store record takes `link`/`links` as data, while a node's slot instance
 * derives them from the link store and must not have them assigned.
 */
function patchLiveSlot(live: object, serialized: object): void {
  const derivesLinks = !isPlainObject(live)
  Object.assign(
    live,
    Object.fromEntries(
      Object.entries(serialized).filter(
        ([key, value]) =>
          value !== undefined &&
          !(derivesLinks && (key === 'link' || key === 'links'))
      )
    )
  )
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

/**
 * Renderer-owned placement geometry. `viewportBounds` returns the visible
 * area in canvas coordinates only while the displayed graph is the scope's
 * owning graph, and null otherwise (background workflow, subgraph editing,
 * no canvas mounted). See ADR-CRDT-PLACEMENT-0035.
 */
export interface SemanticPlacementPort {
  nodeBounds(scope: GraphScope, nodeId: NodeId): PlacementRect | null
  viewportBounds(scope: GraphScope): PlacementRect | null
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
  placement: SemanticPlacementPort
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
  | {
      kind: 'addNode'
      node: PreparedNode
      queued: 'addNode' | 'reconcileNodeFields'
    }
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

const SERIALISABLE_SLOT_FIELDS = [
  'name',
  'localized_name',
  'label',
  'type',
  'dir',
  'removable',
  'shape',
  'color_off',
  'color_on',
  'locked',
  'nameLocked',
  'pos'
] as const satisfies readonly (keyof INodeSlot)[]

function serialisableSlotFields(
  raw: Record<string, unknown>,
  additional: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(
    [...SERIALISABLE_SLOT_FIELDS, ...additional].flatMap((field) =>
      Object.hasOwn(raw, field) ? [[field, structuredClone(raw[field])]] : []
    )
  )
}

/**
 * A supplied input slot whose record has no `link` key carries no link
 * information (as opposed to `link: null`, which means unlinked). Such slots
 * keep the link of the `existing` slot at the same index, or `null` when the
 * node has no slot there yet.
 */
function applySlotLink(
  slot: INodeInputSlot,
  index: number,
  existing?: readonly (NodeState['inputs'][number] | undefined)[]
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
  slot: INodeInputSlot,
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
  existing?: readonly (NodeState['inputs'][number] | undefined)[]
): INodeInputSlot | undefined {
  if (
    typeof raw.name !== 'string' ||
    (typeof raw.type !== 'string' && typeof raw.type !== 'number')
  ) {
    return undefined
  }
  const slot: INodeInputSlot = {
    name: raw.name,
    type: raw.type,
    boundingRect: [0, 0, 0, 0]
  }
  Object.assign(slot, serialisableSlotFields(raw, ['widget']))
  if (raw.link === null || typeof raw.link === 'number') {
    slot.link = raw.link === null ? null : toLinkId(raw.link)
  }
  applySlotLink(slot, index, existing)
  preserveSlotDisplayMetadata(slot, existing?.[index])
  return slot
}

function prepareInputSlots(
  value: unknown,
  existing?: readonly (NodeState['inputs'][number] | undefined)[]
): NodeState['inputs'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw, index) => {
    if (!isRecord(raw)) return []
    const slot = prepareInputSlot(raw, index, existing)
    return slot ? [slot] : []
  })
}

function prepareOutputSlots(value: unknown): NodeState['outputs'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (
      !isRecord(raw) ||
      typeof raw.name !== 'string' ||
      (typeof raw.type !== 'string' && typeof raw.type !== 'number')
    ) {
      return []
    }
    const slot: INodeOutputSlot = {
      name: raw.name,
      type: raw.type,
      boundingRect: [0, 0, 0, 0]
    }
    Object.assign(slot, serialisableSlotFields(raw, ['slot_index', 'widget']))
    if (raw.links === null) slot.links = null
    else if (Array.isArray(raw.links)) {
      slot.links = raw.links.map((id) => toLinkId(Number(id)))
    }
    return [slot]
  })
}

/**
 * Preserves live input order and live-only slots when every document input
 * name exists live. This also admits stale or extension-added slots; it does
 * not identify autogrow as the cause. Otherwise the document list and order
 * replace the live inputs (CRDT-INPUTS-0030).
 */
function mergeInputSlotsByName(
  live: NodeState['inputs'],
  supplied: unknown
): NodeState['inputs'] {
  const documentInputs = Array.isArray(supplied)
    ? supplied.filter(isRecord)
    : []
  const liveByName = documentInputs.map((slot) =>
    live.find((input) => input.name === slot.name)
  )
  if (liveByName.some((match) => match === undefined)) {
    return prepareInputSlots(documentInputs, live)
  }
  const merged = [...live]
  for (const input of prepareInputSlots(documentInputs, liveByName)) {
    const index = merged.findIndex((local) => local.name === input.name)
    if (index < 0) merged.push(input)
    else merged[index] = input
  }
  return merged
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

/**
 * A canvas rename only ever mutates the live node (see
 * useNodeEventHandlers.ts's `handleNodeTitleUpdate`); it never writes back
 * into the CRDT doc. So the payload's title is only as fresh as the last doc
 * mutation that actually changed it, and `existing.titleReconcileBaseline`
 * is the title the doc held as of the last reconcile. When the incoming
 * title matches that baseline, nothing about the doc's title changed since
 * then, so keep the live node's current title instead of replaying the same
 * stale value over an unsynced local rename. An incoming title that differs
 * from the baseline is a genuine doc-side change — e.g. the agent naming or
 * renaming the node — and still wins. A record with no baseline at all
 * (never reconciled) has no evidence the doc title is unchanged, so it
 * always falls through to the payload/registered/type title.
 */
function resolveNodeTitle(
  payload: SemanticNodePayload,
  existing?: NodeState
): string {
  if (
    existing?.titleReconcileBaseline !== undefined &&
    payload.title === existing.titleReconcileBaseline.title
  ) {
    return nodeTitle(existing.title, payload.type)
  }
  return nodeTitle(payload.title, payload.type)
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
    title: resolveNodeTitle(payload, incumbent),
    flags: cloneRecord(payload.flags),
    inputs: prepareInputSlots(payload.inputs, incumbent?.inputs),
    outputs: prepareOutputSlots(payload.outputs),
    mode: Number.isInteger(mode) ? mode : 0,
    properties: cloneRecord(payload.properties) as NodeState['properties'],
    lastSerialization: structuredClone(payload) as unknown as ISerialisedNode,
    titleReconcileBaseline: {
      title: typeof payload.title === 'string' ? payload.title : undefined
    },
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

/**
 * Whether a link's declared origin output type and target input type are
 * both resolvable and definitively incompatible, using the exact rule
 * `connect` enforces before applying a link (`LiteGraph.isValidConnection`).
 * An unresolvable slot (missing slot list, or an index past its end) reports
 * `false` rather than `true`: `connect`'s own "does not exist" checks give
 * that case a more specific rejection reason, and this predicate exists only
 * to let a caller pre-exclude a link it already knows would be refused for
 * an origin/target TYPE mismatch, not to duplicate every reason `connect`
 * can refuse a link.
 *
 * Exposed so `EcsFollowerAdapter` can keep an already-invalid retained link
 * out of what it projects into the local canvas mirror during
 * reconciliation, without duplicating `LiteGraph`'s compatibility rules or
 * risking them drifting from what `connect` actually enforces.
 */
export function isIncompatibleLinkType(link: {
  originSlot: number
  targetSlot: number
  originOutputs?: readonly ISerialisableNodeOutput[]
  targetInputs?: readonly ISerialisableNodeInput[]
}): boolean {
  const originType = link.originOutputs?.[link.originSlot]?.type
  const targetType = link.targetInputs?.[link.targetSlot]?.type
  if (originType === undefined || targetType === undefined) return false
  return !LiteGraph.isValidConnection(originType, targetType)
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
      index === topology.originSlot && isPlainObject(output)
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
      index === topology.targetSlot && isPlainObject(input)
        ? { ...input, link: null }
        : input
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
          if (
            mutation.kind === 'reconcileNode' &&
            existing &&
            existing.type === node.state.type
          ) {
            node.state.inputs = mergeInputSlotsByName(
              existing.inputs,
              mutation.payload.inputs
            )
          }
          nodes.set(key, node.state)
          if (mutation.kind === 'addNode') {
            prepared.push({ kind: 'addNode', node, queued: 'addNode' })
          } else {
            prepared.push({
              kind:
                existing && existing.type !== node.state.type
                  ? 'replaceNode'
                  : 'reconcileNode',
              node
            })
          }
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
            if (existing) {
              prepared.push({ kind: 'replaceNode', node })
            } else {
              prepared.push({
                kind: 'addNode',
                node,
                queued: 'reconcileNodeFields'
              })
            }
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
          let targetInputs = target.inputs
          if (mutation.link.targetInputs) {
            if (target.inputs.some((input) => !isSlotRecord(input))) {
              return 'connect target inputs contain a malformed live slot'
            }
            const name = mutation.link.targetInputs
              .filter(isRecord)
              .at(topology.targetSlot)?.name
            if (typeof name !== 'string') {
              return `connect target slot ${topology.targetSlot} does not exist`
            }
            targetInputs = mergeInputSlotsByName(
              target.inputs,
              mutation.link.targetInputs
            )
            topology.targetSlot = targetInputs.findIndex(
              (input) => input.name === name
            )
          }
          if (topology.originSlot >= originOutputs.length) {
            return `connect origin slot ${topology.originSlot} does not exist`
          }
          if (
            topology.targetSlot < 0 ||
            topology.targetSlot >= targetInputs.length
          ) {
            return `connect target slot ${topology.targetSlot} does not exist`
          }
          const originType = originOutputs[topology.originSlot]?.type
          const targetType = targetInputs[topology.targetSlot]?.type
          if (
            isIncompatibleLinkType({
              originSlot: topology.originSlot,
              targetSlot: topology.targetSlot,
              originOutputs,
              targetInputs
            })
          ) {
            return `connect origin slot ${topology.originSlot} type ${String(originType)} is not compatible with target slot ${topology.targetSlot} type ${String(targetType)}`
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

  function offsetInsertedBatch(
    scope: GraphScope,
    existingIds: readonly NodeId[],
    prepared: readonly PreparedMutation[]
  ): void {
    const inserted = prepared.filter(
      (mutation): mutation is Extract<PreparedMutation, { kind: 'addNode' }> =>
        mutation.kind === 'addNode' && mutation.queued === 'addNode'
    )
    if (inserted.length === 0) return
    const offset = placementOffset({
      existing: existingIds
        .map((id) => deps.placement.nodeBounds(scope, id))
        .filter((rect): rect is PlacementRect => rect !== null),
      viewport: deps.placement.viewportBounds(scope),
      incoming: inserted.map(({ node }) => ({
        x: node.layout.position.x,
        y: node.layout.position.y,
        width: node.layout.size.width,
        height: node.layout.size.height
      }))
    })
    if (!offset) return
    for (const { node } of inserted) {
      node.layout.position = {
        x: node.layout.position.x + offset.dx,
        y: node.layout.position.y + offset.dy
      }
      // The materializer configures the live node from lastSerialization, so
      // its pos must carry the same offset or configure() re-applies the raw
      // coordinates over the adopted layout entry.
      if (node.state.lastSerialization) {
        node.state.lastSerialization.pos = [
          node.layout.position.x,
          node.layout.position.y
        ]
      }
    }
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
   * A reconcile's doc snapshot predates a widget whose live value already
   * changed locally (a human edit, or any write that reached the widget
   * without going through this module's own commit) since it was last read
   * from the doc. Overwriting it here would replay stale text over what the
   * user is looking at (PM-1303/PM-1310 "hypothesis C").
   *
   * An incremental single-widget `setWidget` op is the SAME collision, not an
   * exemption: the host echoes every human `set_widget` back as a doc frame,
   * and each echo carries the whole value as of mint time. While the user is
   * still typing, that echo is stale by however many keystrokes are in
   * flight, and replaying it deletes those keystrokes under the cursor
   * (PM-1191/PM-1697 — the agent-panel typing garble). An agent's
   * `set_widget` onto a widget the user is mid-editing loses the same race.
   * So `commit`'s `setWidget` case consults this guard too; the clearing
   * rule below makes both paths converge the moment the document reflects
   * the local value.
   *
   * Protection lasts until the document actually reflects the local value,
   * not for a single skipped reconcile: the follower has no invariant that
   * only one stale full reconcile can happen before a genuinely newer value
   * lands (an unbound local edit that never minted, followed by a rejected
   * duplicate-add echo re-arming full reconciliation, can deliver the same
   * stale snapshot a second time). So this only lets a reconcile through
   * once its own candidate value already matches the widget's current one -
   * the document has caught up, and that write clears the mark itself, since
   * it carries a context. Anything else keeps skipping and keeps the mark.
   *
   * "Matches" has to be value equality, not reference equality:
   * `parseWidgetValues` (via `cloneWidgetValue`) runs a fresh
   * `structuredClone` over every object-typed candidate, so an
   * object-valued widget's doc-parsed value is never the same object
   * instance as the widget's stored value even once the document
   * genuinely reflects it. `Object.is`/`===` would then never see the two
   * as equal, so the guard could never conclude the document caught up and
   * the dirty mark would never clear except via an explicit `setWidget`.
   */
  function skipStaleReconcile(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue
  ): boolean {
    const id = widgetId(scope.rootGraphId, nodeId, name)
    if (!isWidgetId(id) || !widgetStore.isLocallyDirty(id)) return false
    return !isEqual(widgetStore.getWidget(id)?.value, value)
  }

  /**
   * The `named` half of `applyWidgetValues`: values keyed by widget name,
   * applied in whatever order the doc map iterates.
   */
  function applyNamedWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    values: ReadonlyMap<string, WidgetValue>,
    context: RemoteMutationContext,
    guardLocalEdits: boolean
  ): void {
    for (const [name, value] of values) {
      if (guardLocalEdits && skipStaleReconcile(scope, nodeId, name, value)) {
        continue
      }
      setWidgetValue(scope, nodeId, name, value, context)
    }
  }

  /**
   * The `positional` half of `applyWidgetValues`: values bind to the live
   * node's serialized widgets in order, the same order `LGraphNode.serialize`
   * wrote them in.
   */
  function applyPositionalWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    values: readonly WidgetValue[],
    context: RemoteMutationContext,
    guardLocalEdits: boolean
  ): void {
    const serialized = widgetStore
      .getNodeWidgets(scope.rootGraphId, nodeId)
      .filter((widget) => widget.serialize !== false)
      .slice(0, values.length)
    for (const [index, widget] of serialized.entries()) {
      if (
        guardLocalEdits &&
        skipStaleReconcile(scope, nodeId, widget.name, values[index])
      ) {
        continue
      }
      setWidgetValue(scope, nodeId, widget.name, values[index], context)
    }
  }

  /**
   * A doc entry for a node that is already live is a value patch: the live
   * widgets keep their registered type, options, and state identity, and a
   * value the payload omits keeps its current value.
   *
   * `guardLocalEdits` skips a widget via {@link skipStaleReconcile}; it is only set
   * for a plain node's `reconcileNode`. A subgraph host's `reconcileNodeFields`
   * leaves it off: a host's promoted widgets are wired by `SubgraphNode`'s own
   * projection (`promotedWidgetStoreProjection.ts`), which writes them
   * directly (no `RemoteMutationContext`) as a routine, structural part of
   * (re)attaching the host - not a human edit - so the same signal that
   * catches a stale reconcile on a plain widget would misfire here.
   */
  function applyWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    widgets: WidgetValuePayload,
    context: RemoteMutationContext,
    guardLocalEdits: boolean
  ): void {
    switch (widgets.kind) {
      case 'omitted':
        return
      case 'named':
        applyNamedWidgetValues(
          scope,
          nodeId,
          widgets.values,
          context,
          guardLocalEdits
        )
        return
      case 'positional':
        applyPositionalWidgetValues(
          scope,
          nodeId,
          widgets.values,
          context,
          guardLocalEdits
        )
        return
      default: {
        const unhandled: never = widgets
        return unhandled
      }
    }
  }

  /**
   * `addNode`/`reconcileNode`/`replaceNode` share one upsert: a `replaceNode`
   * onto an existing node deletes it first: a `reconcileNode` onto an
   * existing node patches fields and widgets in place (through
   * `applyWidgetValues`'s local-edit guard); anything else registers the
   * node fresh, from placeholder widgets.
   */
  function commitUpsertNode(
    scope: GraphScope,
    mutation: Extract<
      PreparedMutation,
      { kind: 'addNode' | 'reconcileNode' | 'replaceNode' }
    >,
    context: RemoteMutationContext
  ): void {
    let existing = nodeStore.getNode(scope.rootGraphId, mutation.node.state.id)
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
        context,
        true
      )
      return
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
          commitUpsertNode(scope, mutation, context)
          break
        }
        case 'reconcileNodeFields': {
          nodeStore.updateNodeFields(
            scope,
            mutation.state.id,
            mutation.state,
            context
          )
          applyWidgetValues(
            scope,
            mutation.state.id,
            mutation.widgets,
            context,
            false
          )
          break
        }
        case 'setWidget': {
          if (
            !skipStaleReconcile(
              scope,
              mutation.nodeId,
              mutation.name,
              mutation.value
            )
          ) {
            setWidgetValue(
              scope,
              mutation.nodeId,
              mutation.name,
              mutation.value,
              context
            )
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
            const outputs = [...mutation.originOutputs]
            // Outputs keep their document positions, so each live slot is
            // patched from the serialized slot sharing its index.
            for (const [index, output] of origin.outputs.entries()) {
              if (isSlotRecord(output) && isSlotRecord(outputs[index])) {
                patchLiveSlot(output, outputs[index])
              }
              outputs[index] = output
            }
            nodeStore.updateNode(
              scope,
              origin.id,
              { ...origin, outputs },
              context
            )
          }
          if (target && mutation.targetInputs) {
            const inputs = [...mutation.targetInputs]
            // Inputs may have been reordered locally, so each live slot is
            // matched to its serialized slot by name (CRDT-INPUTS-0030).
            for (const input of target.inputs) {
              if (!isSlotRecord(input)) continue
              const index = inputs.findIndex(
                (candidate) => candidate.name === input.name
              )
              if (index < 0) continue
              patchLiveSlot(input, inputs[index])
              inputs[index] = input
            }
            nodeStore.updateNode(
              scope,
              target.id,
              { ...target, inputs },
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
      const existingIds = nodeStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map((node) => node.id)
      const prepared = prepare(scope, queued)
      if (typeof prepared === 'string') return fail(prepared)
      offsetInsertedBatch(scope, existingIds, prepared)
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
