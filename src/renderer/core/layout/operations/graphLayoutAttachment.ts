/**
 * Layout attachment for litegraph entities.
 *
 * Geometry joins and leaves the layout store with the entity that owns it, so
 * every attach/detach path — including bulk teardown — goes through these
 * helpers rather than re-deriving the store writes by hand.
 *
 * Each attached instance holds a private `{ graphId, id }` descriptor captured
 * at attach time. The store is purely ID-addressed; detach and replacement
 * clear the descriptor before changing the store so stale instances cannot write.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  LayoutOperation,
  LayoutOperationResult,
  Point,
  Size
} from '@/renderer/core/layout/types'
import type { UUID } from '@/utils/uuid'

type GraphLayoutOwner = Pick<
  LGraph,
  '_nodes' | '_groups' | '_subgraphs' | 'reroutes'
>
type LayoutGraph = { rootGraph: { id: UUID } }

interface LayoutAttachment<TId> {
  graphId: UUID
  id: TId
}

const nodeAttachments = new WeakMap<
  LGraphNode,
  LayoutAttachment<LGraphNode['id']>
>()
const groupAttachments = new WeakMap<
  LGraphGroup,
  LayoutAttachment<LGraphGroup['id']>
>()
const rerouteAttachments = new WeakMap<
  Reroute,
  LayoutAttachment<Reroute['id']>
>()

interface TrackedNodeLayoutAttachment {
  entity: 'node'
  instance: LGraphNode
  attachment: LayoutAttachment<LGraphNode['id']>
  layout?: NonNullable<ReturnType<typeof layoutStore.getNodeLayoutRef>['value']>
}

interface TrackedGroupLayoutAttachment {
  entity: 'group'
  instance: LGraphGroup
  attachment: LayoutAttachment<LGraphGroup['id']>
  layout?: NonNullable<ReturnType<typeof layoutStore.getGroupLayout>>
}

interface TrackedRerouteLayoutAttachment {
  entity: 'reroute'
  instance: Reroute
  attachment: LayoutAttachment<Reroute['id']>
  layout?: NonNullable<ReturnType<typeof layoutStore.getRerouteLayout>>
}

type TrackedLayoutAttachment =
  | TrackedNodeLayoutAttachment
  | TrackedGroupLayoutAttachment
  | TrackedRerouteLayoutAttachment

/** Layout mutations attributed to the canvas, for direct delete calls. */
export function canvasLayoutMutations() {
  const mutations = useLayoutMutations()
  mutations.setSource(LayoutSource.Canvas)
  return mutations
}

function canvasOperationMeta() {
  layoutStore.setSource(LayoutSource.Canvas)
  return {
    actor: layoutStore.getCurrentActor(),
    source: layoutStore.getCurrentSource(),
    timestamp: Date.now()
  }
}

function trackNodeLayoutAttachment(
  node: LGraphNode
): TrackedNodeLayoutAttachment | undefined {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  const storedLayout = layoutStore.getNodeLayoutRef(
    attachment.graphId,
    attachment.id
  ).value
  return {
    entity: 'node',
    instance: node,
    layout: storedLayout ?? undefined,
    attachment
  }
}

function trackGroupLayoutAttachment(
  group: LGraphGroup
): TrackedGroupLayoutAttachment | undefined {
  const attachment = groupAttachments.get(group)
  if (!attachment) return
  const storedLayout = layoutStore.getGroupLayout(
    attachment.graphId,
    attachment.id
  )
  return {
    entity: 'group',
    instance: group,
    layout: storedLayout ?? undefined,
    attachment
  }
}

function trackRerouteLayoutAttachment(
  reroute: Reroute
): TrackedRerouteLayoutAttachment | undefined {
  const attachment = rerouteAttachments.get(reroute)
  if (!attachment) return
  const storedLayout = layoutStore.getRerouteLayout(
    attachment.graphId,
    attachment.id
  )
  return {
    entity: 'reroute',
    instance: reroute,
    layout: storedLayout ?? undefined,
    attachment
  }
}

function trackAllGraphLayoutAttachments(
  graph: GraphLayoutOwner
): TrackedLayoutAttachment[] {
  const attachments: TrackedLayoutAttachment[] = []
  const visited = new Set<GraphLayoutOwner>()
  function track(owner: GraphLayoutOwner): void {
    if (visited.has(owner)) return
    visited.add(owner)
    for (const node of owner._nodes) {
      const attachment = trackNodeLayoutAttachment(node)
      if (attachment) attachments.push(attachment)
    }
    for (const group of owner._groups) {
      const attachment = trackGroupLayoutAttachment(group)
      if (attachment) attachments.push(attachment)
    }
    for (const reroute of owner.reroutes.values()) {
      const attachment = trackRerouteLayoutAttachment(reroute)
      if (attachment) attachments.push(attachment)
    }
    for (const subgraph of owner._subgraphs.values()) track(subgraph)
  }
  track(graph)
  return attachments
}

function restoreLocalLayoutAttachment(tracked: TrackedLayoutAttachment): void {
  if (tracked.entity === 'node') {
    nodeAttachments.set(tracked.instance, tracked.attachment)
    tracked.instance._layoutRegistered = true
    tracked.instance._geometryVersion = layoutStore.geometryVersion
  } else if (tracked.entity === 'group') {
    groupAttachments.set(tracked.instance, tracked.attachment)
  } else {
    rerouteAttachments.set(tracked.instance, tracked.attachment)
  }
}

function clearLocalLayoutAttachment(tracked: TrackedLayoutAttachment): void {
  if (tracked.entity === 'node') {
    nodeAttachments.delete(tracked.instance)
    tracked.instance._layoutRegistered = false
  } else if (tracked.entity === 'group') {
    groupAttachments.delete(tracked.instance)
  } else {
    rerouteAttachments.delete(tracked.instance)
  }
}

function createDeleteLayoutOperation(
  tracked: TrackedLayoutAttachment,
  meta = canvasOperationMeta()
): LayoutOperation {
  if (tracked.entity === 'node') {
    const { graphId, id } = tracked.attachment
    return {
      ...meta,
      entity: 'node',
      graphId,
      nodeId: id,
      type: 'deleteNode'
    }
  }
  if (tracked.entity === 'group') {
    const { graphId, id } = tracked.attachment
    return {
      ...meta,
      entity: 'group',
      graphId,
      groupId: id,
      type: 'deleteGroup'
    }
  }
  const { graphId, id } = tracked.attachment
  return {
    ...meta,
    entity: 'reroute',
    graphId,
    rerouteId: id,
    type: 'deleteReroute'
  }
}

function createRestoreLayoutOperation(
  tracked: TrackedLayoutAttachment,
  meta = canvasOperationMeta()
): LayoutOperation | undefined {
  if (!tracked.layout) return
  if (tracked.entity === 'node') {
    const { graphId, id } = tracked.attachment
    return {
      ...meta,
      entity: 'node',
      graphId,
      layout: tracked.layout,
      nodeId: id,
      type: 'createNode'
    }
  }
  if (tracked.entity === 'group') {
    const { graphId, id } = tracked.attachment
    return {
      ...meta,
      entity: 'group',
      graphId,
      groupId: id,
      layout: tracked.layout,
      type: 'createGroup'
    }
  }
  const { graphId, id } = tracked.attachment
  return {
    ...meta,
    entity: 'reroute',
    graphId,
    position: tracked.layout.position,
    rerouteId: id,
    type: 'createReroute'
  }
}

function restoreGraphLayoutAttachment(tracked: TrackedLayoutAttachment): void {
  const operation = createRestoreLayoutOperation(tracked)
  if (!operation) return
  try {
    if (layoutStore.applyOperation(operation) === 'applied')
      restoreLocalLayoutAttachment(tracked)
  } catch (error) {
    console.error('Failed to restore layout attachment', error)
  }
}

export interface GraphLayoutDetach {
  readonly result: LayoutOperationResult
  restore(): void
}

function createGraphLayoutDetach(
  attachment: TrackedLayoutAttachment | undefined,
  detach: () => LayoutOperationResult
): GraphLayoutDetach {
  const result = detach()
  return {
    result,
    restore() {
      if (result === 'applied' && attachment?.layout)
        restoreGraphLayoutAttachment(attachment)
    }
  }
}

/** A newly attached node stacks above those already attached. */
function attachNodeLayout(
  graph: LayoutGraph,
  node: LGraphNode
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  const retained = nodeAttachments.get(node)
  if (retained) {
    nodeAttachments.delete(node)
    const cleanupResult = layoutStore.applyOperation({
      ...canvasOperationMeta(),
      entity: 'node',
      graphId: retained.graphId,
      nodeId: retained.id,
      type: 'deleteNode'
    })
    if (cleanupResult === 'rejected') {
      nodeAttachments.set(node, retained)
      return cleanupResult
    }
  }

  const position = { x: node._pos[0], y: node._pos[1] }
  const size = { width: node._size[0], height: node._size[1] }
  nodeAttachments.set(node, { graphId, id: node.id })
  let result: LayoutOperationResult
  try {
    result = layoutStore.applyOperation({
      ...canvasOperationMeta(),
      entity: 'node',
      graphId,
      layout: {
        bounds: { ...position, ...size },
        id: node.id,
        position,
        size,
        zIndex: layoutStore.allocateZIndex(),
        visible: true
      },
      nodeId: node.id,
      type: 'createNode'
    })
  } catch (error) {
    nodeAttachments.delete(node)
    throw error
  }
  if (result === 'applied') {
    node._layoutRegistered = true
    node._geometryVersion = layoutStore.geometryVersion
  } else {
    nodeAttachments.delete(node)
  }
  return result
}

function adoptExistingLayout(
  graphId: UUID,
  attachment:
    | { entity: 'node'; id: LGraphNode['id']; instance: LGraphNode }
    | { entity: 'group'; id: LGraphGroup['id']; instance: LGraphGroup }
    | { entity: 'reroute'; id: Reroute['id']; instance: Reroute }
): LayoutOperationResult {
  const storedLayout =
    attachment.entity === 'node'
      ? layoutStore.getNodeLayout(graphId, attachment.id)
      : attachment.entity === 'group'
        ? layoutStore.getGroupLayout(graphId, attachment.id)
        : layoutStore.getRerouteLayout(graphId, attachment.id)
  if (!storedLayout) return 'no-op'

  if (attachment.entity === 'node') {
    const { id, instance } = attachment
    nodeAttachments.set(instance, { graphId, id })
    instance._layoutRegistered = true
    instance._geometryVersion = layoutStore.geometryVersion
  } else if (attachment.entity === 'group') {
    const { id, instance } = attachment
    groupAttachments.set(instance, { graphId, id })
  } else {
    const { id, instance } = attachment
    rerouteAttachments.set(instance, { graphId, id })
  }
  return 'applied'
}

type AttachLayoutArgs =
  | [
      graph: LayoutGraph,
      entity: 'node',
      instance: LGraphNode,
      options: { adoptExisting: boolean }
    ]
  | [
      graph: LayoutGraph,
      entity: 'group',
      instance: LGraphGroup,
      options?: { adoptExisting?: boolean }
    ]
  | [
      graph: LayoutGraph,
      entity: 'reroute',
      instance: Reroute,
      options: { position: Point }
    ]

export function attachLayout(
  ...[graph, entity, instance, options = {}]: AttachLayoutArgs
): LayoutOperationResult {
  if (entity === 'node' && '_layoutRegistered' in instance) {
    const result = attachNodeLayout(graph, instance)
    return result === 'no-op' &&
      'adoptExisting' in options &&
      options.adoptExisting
      ? adoptExistingLayout(graph.rootGraph.id, {
          entity,
          id: instance.id,
          instance
        })
      : result
  }
  if (entity === 'group' && '_nodes' in instance) {
    const result = attachGroupLayout(graph, instance)
    return result === 'no-op' &&
      'adoptExisting' in options &&
      options.adoptExisting
      ? adoptExistingLayout(graph.rootGraph.id, {
          entity,
          id: instance.id,
          instance
        })
      : result
  }
  if (entity === 'reroute' && 'position' in options && 'network' in instance) {
    return attachRerouteLayout(graph, instance, options.position)
  }
  return 'rejected'
}

type DetachLayoutArgs =
  | [LayoutGraph, 'node', LGraphNode]
  | [LayoutGraph, 'group', LGraphGroup]
  | [LayoutGraph, 'reroute', Reroute]

export function detachLayout(
  ...[graph, entity, instance]: DetachLayoutArgs
): GraphLayoutDetach {
  if (entity === 'node' && '_layoutRegistered' in instance) {
    return createGraphLayoutDetach(trackNodeLayoutAttachment(instance), () =>
      detachNodeLayout(graph, instance)
    )
  }
  if (entity === 'group' && '_nodes' in instance) {
    return createGraphLayoutDetach(trackGroupLayoutAttachment(instance), () =>
      detachGroupLayout(graph, instance)
    )
  }
  if (entity === 'reroute' && 'network' in instance) {
    return createGraphLayoutDetach(trackRerouteLayoutAttachment(instance), () =>
      detachRerouteLayout(graph, instance)
    )
  }
  return createGraphLayoutDetach(undefined, () => 'rejected')
}

export function transferLayoutAttachment(
  node: LGraphNode,
  replacement: LGraphNode
): LayoutOperationResult {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return 'no-op'
  if (
    nodeAttachments.has(replacement) ||
    attachment.id !== replacement.id ||
    !layoutStore.getNodeLayout(attachment.graphId, attachment.id)
  )
    return 'rejected'

  nodeAttachments.delete(node)
  node._layoutRegistered = false
  nodeAttachments.set(replacement, attachment)
  replacement._layoutRegistered = true
  replacement._geometryVersion = layoutStore.geometryVersion
  return 'applied'
}

export function materializeRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute
): LayoutOperationResult {
  const adopted = adoptExistingLayout(graph.rootGraph.id, {
    entity: 'reroute',
    id: reroute.id,
    instance: reroute
  })
  if (adopted === 'applied') return adopted

  return attachRerouteLayout(graph, reroute, {
    x: reroute.pos[0],
    y: reroute.pos[1]
  })
}

function moveNodeLayout(node: LGraphNode, position: Point): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: attachment.graphId,
    nodeId: attachment.id,
    position,
    type: 'moveNode'
  })
}

export function resizeLayout(node: LGraphNode, size: Size): void {
  const attachment = nodeAttachments.get(node)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: attachment.graphId,
    nodeId: attachment.id,
    size,
    type: 'resizeNode'
  })
}

function detachNodeLayout(
  _graph: LayoutGraph,
  node: LGraphNode
): LayoutOperationResult {
  const retainedAttachment = nodeAttachments.get(node)
  if (!retainedAttachment) return 'no-op'
  const { graphId, id: nodeId } = retainedAttachment
  layoutStore.readNodeRect(graphId, nodeId, node._posSize)
  nodeAttachments.delete(node)
  node._layoutRegistered = false
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId,
    nodeId,
    type: 'deleteNode'
  })
  if (result === 'rejected') {
    nodeAttachments.set(node, retainedAttachment)
    node._layoutRegistered = true
  }
  return result
}

function attachGroupLayout(
  graph: LayoutGraph,
  group: LGraphGroup
): LayoutOperationResult {
  const result = canvasLayoutMutations().createGroup(
    graph.rootGraph.id,
    group.id,
    {
      position: { x: group.pos[0], y: group.pos[1] },
      size: { width: group.size[0], height: group.size[1] }
    }
  )
  if (result === 'applied')
    groupAttachments.set(group, {
      graphId: graph.rootGraph.id,
      id: group.id
    })
  return result
}

function detachGroupLayout(
  _graph: LayoutGraph,
  group: LGraphGroup
): LayoutOperationResult {
  const retainedAttachment = groupAttachments.get(group)
  if (!retainedAttachment) return 'no-op'
  const { graphId, id: groupId } = retainedAttachment
  groupAttachments.delete(group)
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId,
    groupId,
    type: 'deleteGroup'
  })
  if (result === 'rejected') groupAttachments.set(group, retainedAttachment)
  return result
}

export function setBoundsLayout(
  _graph: { rootGraph: { id: UUID } },
  group: LGraphGroup,
  position: Point,
  size: Size
): void {
  const attachment = groupAttachments.get(group)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId: attachment.graphId,
    groupId: attachment.id,
    position,
    size,
    type: 'setGroupBounds'
  })
}

function detachRerouteLayout(
  _graph: LayoutGraph,
  reroute: Reroute
): LayoutOperationResult {
  const retainedAttachment = rerouteAttachments.get(reroute)
  if (!retainedAttachment) return 'no-op'
  const { graphId, id: rerouteId } = retainedAttachment
  syncReroutePositionFromLayout(reroute)
  rerouteAttachments.delete(reroute)
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId,
    rerouteId,
    type: 'deleteReroute'
  })
  if (result === 'rejected') rerouteAttachments.set(reroute, retainedAttachment)
  return result
}

function attachRerouteLayout(
  graph: LayoutGraph,
  reroute: Reroute,
  position: Point
): LayoutOperationResult {
  const result = canvasLayoutMutations().createReroute(
    graph.rootGraph.id,
    reroute.id,
    position
  )
  if (result === 'applied')
    rerouteAttachments.set(reroute, {
      graphId: graph.rootGraph.id,
      id: reroute.id
    })
  return result
}

function moveRerouteLayout(
  _graph: { rootGraph: { id: UUID } },
  reroute: Reroute,
  position: Point
): void {
  const attachment = rerouteAttachments.get(reroute)
  if (!attachment) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId: attachment.graphId,
    position,
    rerouteId: attachment.id,
    type: 'moveReroute'
  })
}

type MoveLayoutArgs =
  | [LayoutGraph, 'node', LGraphNode, Point]
  | [LayoutGraph, 'reroute', Reroute, Point]

export function moveLayout(
  ...[graph, entity, instance, position]: MoveLayoutArgs
): void {
  if (entity === 'node' && '_layoutRegistered' in instance) {
    moveNodeLayout(instance, position)
  } else if (entity === 'reroute' && 'network' in instance) {
    moveRerouteLayout(graph, instance, position)
  }
}

export function hasLayoutAttachment(reroute: Reroute): boolean {
  return rerouteAttachments.has(reroute)
}

function syncReroutePositionFromLayout(reroute: Reroute): void {
  void reroute.pos[0]
}

/**
 * Drops every layout entry a graph owns, including those inside the subgraph
 * definitions it holds. Mirrors `unregisterAllNodeStates`; call it from the
 * same places, before the entity containers are emptied.
 */
export function detachAllGraphLayout(
  graph: GraphLayoutOwner
): LayoutOperationResult {
  const attachments = trackAllGraphLayoutAttachments(graph)
  const meta = canvasOperationMeta()
  for (const attachment of attachments) {
    if (attachment.entity === 'reroute' && attachment.layout) {
      syncReroutePositionFromLayout(attachment.instance)
    }
  }
  const operations = attachments.map((attachment) =>
    createDeleteLayoutOperation(attachment, meta)
  )
  for (const attachment of attachments) clearLocalLayoutAttachment(attachment)
  const result = layoutStore.applyOperations(operations)
  if (result === 'rejected') {
    for (const attachment of attachments)
      restoreLocalLayoutAttachment(attachment)
  }
  return result
}
