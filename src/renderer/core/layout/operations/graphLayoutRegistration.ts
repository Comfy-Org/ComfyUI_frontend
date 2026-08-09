/**
 * Layout registration for litegraph entities.
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

interface LayoutRegistration<TId> {
  graphId: UUID
  id: TId
}

const nodeRegistrations = new WeakMap<
  LGraphNode,
  LayoutRegistration<LGraphNode['id']>
>()
const groupRegistrations = new WeakMap<
  LGraphGroup,
  LayoutRegistration<LGraphGroup['id']>
>()
const rerouteRegistrations = new WeakMap<
  Reroute,
  LayoutRegistration<Reroute['id']>
>()

interface TrackedNodeLayoutRegistration {
  entity: 'node'
  instance: LGraphNode
  registration: LayoutRegistration<LGraphNode['id']>
  layout?: NonNullable<ReturnType<typeof layoutStore.getNodeLayoutRef>['value']>
}

interface TrackedGroupLayoutRegistration {
  entity: 'group'
  instance: LGraphGroup
  registration: LayoutRegistration<LGraphGroup['id']>
  layout?: NonNullable<ReturnType<typeof layoutStore.getGroupLayout>>
}

interface TrackedRerouteLayoutRegistration {
  entity: 'reroute'
  instance: Reroute
  registration: LayoutRegistration<Reroute['id']>
  layout?: NonNullable<ReturnType<typeof layoutStore.getRerouteLayout>>
}

type TrackedLayoutRegistration =
  | TrackedNodeLayoutRegistration
  | TrackedGroupLayoutRegistration
  | TrackedRerouteLayoutRegistration

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

function trackNodeLayoutRegistration(
  node: LGraphNode
): TrackedNodeLayoutRegistration | undefined {
  const registration = nodeRegistrations.get(node)
  if (!registration) return
  const storedLayout = layoutStore.getNodeLayoutRef(
    registration.graphId,
    registration.id
  ).value
  return {
    entity: 'node',
    instance: node,
    layout: storedLayout ?? undefined,
    registration
  }
}

function trackGroupLayoutRegistration(
  group: LGraphGroup
): TrackedGroupLayoutRegistration | undefined {
  const registration = groupRegistrations.get(group)
  if (!registration) return
  const storedLayout = layoutStore.getGroupLayout(
    registration.graphId,
    registration.id
  )
  return {
    entity: 'group',
    instance: group,
    layout: storedLayout ?? undefined,
    registration
  }
}

function trackRerouteLayoutRegistration(
  reroute: Reroute
): TrackedRerouteLayoutRegistration | undefined {
  const registration = rerouteRegistrations.get(reroute)
  if (!registration) return
  const storedLayout = layoutStore.getRerouteLayout(
    registration.graphId,
    registration.id
  )
  return {
    entity: 'reroute',
    instance: reroute,
    layout: storedLayout ?? undefined,
    registration
  }
}

function trackAllGraphLayoutRegistrations(
  graph: GraphLayoutOwner
): TrackedLayoutRegistration[] {
  const registrations: TrackedLayoutRegistration[] = []
  const visited = new Set<GraphLayoutOwner>()
  function track(owner: GraphLayoutOwner): void {
    if (visited.has(owner)) return
    visited.add(owner)
    for (const node of owner._nodes) {
      const registration = trackNodeLayoutRegistration(node)
      if (registration) registrations.push(registration)
    }
    for (const group of owner._groups) {
      const registration = trackGroupLayoutRegistration(group)
      if (registration) registrations.push(registration)
    }
    for (const reroute of owner.reroutes.values()) {
      const registration = trackRerouteLayoutRegistration(reroute)
      if (registration) registrations.push(registration)
    }
    for (const subgraph of owner._subgraphs.values()) track(subgraph)
  }
  track(graph)
  return registrations
}

function restoreLocalLayoutRegistration(
  tracked: TrackedLayoutRegistration
): void {
  if (tracked.entity === 'node') {
    nodeRegistrations.set(tracked.instance, tracked.registration)
    tracked.instance._layoutRegistered = true
    tracked.instance._geometryVersion = layoutStore.geometryVersion
  } else if (tracked.entity === 'group') {
    groupRegistrations.set(tracked.instance, tracked.registration)
  } else {
    rerouteRegistrations.set(tracked.instance, tracked.registration)
  }
}

function clearLocalLayoutRegistration(
  tracked: TrackedLayoutRegistration
): void {
  if (tracked.entity === 'node') {
    nodeRegistrations.delete(tracked.instance)
    tracked.instance._layoutRegistered = false
  } else if (tracked.entity === 'group') {
    groupRegistrations.delete(tracked.instance)
  } else {
    rerouteRegistrations.delete(tracked.instance)
  }
}

function createDeleteLayoutOperation(
  tracked: TrackedLayoutRegistration,
  meta = canvasOperationMeta()
): LayoutOperation {
  if (tracked.entity === 'node') {
    const { graphId, id } = tracked.registration
    return {
      ...meta,
      entity: 'node',
      graphId,
      nodeId: id,
      type: 'deleteNode'
    }
  }
  if (tracked.entity === 'group') {
    const { graphId, id } = tracked.registration
    return {
      ...meta,
      entity: 'group',
      graphId,
      groupId: id,
      type: 'deleteGroup'
    }
  }
  const { graphId, id } = tracked.registration
  return {
    ...meta,
    entity: 'reroute',
    graphId,
    rerouteId: id,
    type: 'deleteReroute'
  }
}

function createRestoreLayoutOperation(
  tracked: TrackedLayoutRegistration,
  meta = canvasOperationMeta()
): LayoutOperation | undefined {
  if (!tracked.layout) return
  if (tracked.entity === 'node') {
    const { graphId, id } = tracked.registration
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
    const { graphId, id } = tracked.registration
    return {
      ...meta,
      entity: 'group',
      graphId,
      groupId: id,
      layout: tracked.layout,
      type: 'createGroup'
    }
  }
  const { graphId, id } = tracked.registration
  return {
    ...meta,
    entity: 'reroute',
    graphId,
    position: tracked.layout.position,
    rerouteId: id,
    type: 'createReroute'
  }
}

function restoreGraphLayoutRegistration(
  tracked: TrackedLayoutRegistration
): void {
  const operation = createRestoreLayoutOperation(tracked)
  if (!operation) return
  try {
    if (layoutStore.applyOperation(operation) === 'applied')
      restoreLocalLayoutRegistration(tracked)
  } catch (error) {
    console.error('Failed to restore layout registration', error)
  }
}

export interface GraphLayoutDetach {
  readonly result: LayoutOperationResult
  restore(): void
}

function createGraphLayoutDetach(
  registration: TrackedLayoutRegistration | undefined,
  unregister: () => LayoutOperationResult
): GraphLayoutDetach {
  const result = unregister()
  return {
    result,
    restore() {
      if (result === 'applied' && registration?.layout)
        restoreGraphLayoutRegistration(registration)
    }
  }
}

/** A newly attached node stacks above those already registered. */
function registerNodeLayout(
  graph: LayoutGraph,
  node: LGraphNode
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  const retained = nodeRegistrations.get(node)
  if (retained) {
    nodeRegistrations.delete(node)
    const cleanupResult = layoutStore.applyOperation({
      ...canvasOperationMeta(),
      entity: 'node',
      graphId: retained.graphId,
      nodeId: retained.id,
      type: 'deleteNode'
    })
    if (cleanupResult === 'rejected') {
      nodeRegistrations.set(node, retained)
      return cleanupResult
    }
  }

  const position = { x: node._pos[0], y: node._pos[1] }
  const size = { width: node._size[0], height: node._size[1] }
  nodeRegistrations.set(node, { graphId, id: node.id })
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
    nodeRegistrations.delete(node)
    throw error
  }
  if (result === 'applied') {
    node._layoutRegistered = true
    node._geometryVersion = layoutStore.geometryVersion
  } else {
    nodeRegistrations.delete(node)
  }
  return result
}

function adoptExistingLayout(
  graphId: UUID,
  registration:
    | { entity: 'node'; id: LGraphNode['id']; instance: LGraphNode }
    | { entity: 'group'; id: LGraphGroup['id']; instance: LGraphGroup }
    | { entity: 'reroute'; id: Reroute['id']; instance: Reroute }
): LayoutOperationResult {
  const storedLayout =
    registration.entity === 'node'
      ? layoutStore.getNodeLayout(graphId, registration.id)
      : registration.entity === 'group'
        ? layoutStore.getGroupLayout(graphId, registration.id)
        : layoutStore.getRerouteLayout(graphId, registration.id)
  if (!storedLayout) return 'no-op'

  if (registration.entity === 'node') {
    const { id, instance } = registration
    nodeRegistrations.set(instance, { graphId, id })
    instance._layoutRegistered = true
    instance._geometryVersion = layoutStore.geometryVersion
  } else if (registration.entity === 'group') {
    const { id, instance } = registration
    groupRegistrations.set(instance, { graphId, id })
  } else {
    const { id, instance } = registration
    rerouteRegistrations.set(instance, { graphId, id })
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
    const result = registerNodeLayout(graph, instance)
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
    const result = registerGroupLayout(graph, instance)
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
    return registerRerouteLayout(graph, instance, options.position)
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
    return createGraphLayoutDetach(trackNodeLayoutRegistration(instance), () =>
      unregisterNodeLayout(graph, instance)
    )
  }
  if (entity === 'group' && '_nodes' in instance) {
    return createGraphLayoutDetach(trackGroupLayoutRegistration(instance), () =>
      unregisterGroupLayout(graph, instance)
    )
  }
  if (entity === 'reroute' && 'network' in instance) {
    return createGraphLayoutDetach(
      trackRerouteLayoutRegistration(instance),
      () => unregisterRerouteLayout(graph, instance)
    )
  }
  return createGraphLayoutDetach(undefined, () => 'rejected')
}

export function transferLayoutRegistration(
  node: LGraphNode,
  replacement: LGraphNode
): LayoutOperationResult {
  const registration = nodeRegistrations.get(node)
  if (!registration) return 'no-op'
  if (
    nodeRegistrations.has(replacement) ||
    registration.id !== replacement.id ||
    !layoutStore.getNodeLayout(registration.graphId, registration.id)
  )
    return 'rejected'

  nodeRegistrations.delete(node)
  node._layoutRegistered = false
  nodeRegistrations.set(replacement, registration)
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

  return registerRerouteLayout(graph, reroute, {
    x: reroute.pos[0],
    y: reroute.pos[1]
  })
}

function moveNodeLayout(node: LGraphNode, position: Point): void {
  const registration = nodeRegistrations.get(node)
  if (!registration) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: registration.graphId,
    nodeId: registration.id,
    position,
    type: 'moveNode'
  })
}

export function resizeLayout(node: LGraphNode, size: Size): void {
  const registration = nodeRegistrations.get(node)
  if (!registration) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: registration.graphId,
    nodeId: registration.id,
    size,
    type: 'resizeNode'
  })
}

function unregisterNodeLayout(
  _graph: LayoutGraph,
  node: LGraphNode
): LayoutOperationResult {
  const retainedRegistration = nodeRegistrations.get(node)
  if (!retainedRegistration) return 'no-op'
  const { graphId, id: nodeId } = retainedRegistration
  layoutStore.readNodeRect(graphId, nodeId, node._posSize)
  nodeRegistrations.delete(node)
  node._layoutRegistered = false
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId,
    nodeId,
    type: 'deleteNode'
  })
  if (result === 'rejected') {
    nodeRegistrations.set(node, retainedRegistration)
    node._layoutRegistered = true
  }
  return result
}

function registerGroupLayout(
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
    groupRegistrations.set(group, {
      graphId: graph.rootGraph.id,
      id: group.id
    })
  return result
}

function unregisterGroupLayout(
  _graph: LayoutGraph,
  group: LGraphGroup
): LayoutOperationResult {
  const retainedRegistration = groupRegistrations.get(group)
  if (!retainedRegistration) return 'no-op'
  const { graphId, id: groupId } = retainedRegistration
  groupRegistrations.delete(group)
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId,
    groupId,
    type: 'deleteGroup'
  })
  if (result === 'rejected') groupRegistrations.set(group, retainedRegistration)
  return result
}

export function setBoundsLayout(
  _graph: { rootGraph: { id: UUID } },
  group: LGraphGroup,
  position: Point,
  size: Size
): void {
  const registration = groupRegistrations.get(group)
  if (!registration) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId: registration.graphId,
    groupId: registration.id,
    position,
    size,
    type: 'setGroupBounds'
  })
}

function unregisterRerouteLayout(
  _graph: LayoutGraph,
  reroute: Reroute
): LayoutOperationResult {
  const retainedRegistration = rerouteRegistrations.get(reroute)
  if (!retainedRegistration) return 'no-op'
  const { graphId, id: rerouteId } = retainedRegistration
  syncReroutePositionFromLayout(reroute)
  rerouteRegistrations.delete(reroute)
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId,
    rerouteId,
    type: 'deleteReroute'
  })
  if (result === 'rejected')
    rerouteRegistrations.set(reroute, retainedRegistration)
  return result
}

function registerRerouteLayout(
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
    rerouteRegistrations.set(reroute, {
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
  const registration = rerouteRegistrations.get(reroute)
  if (!registration) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId: registration.graphId,
    position,
    rerouteId: registration.id,
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

export function isLayoutRegistered(reroute: Reroute): boolean {
  return rerouteRegistrations.has(reroute)
}

function syncReroutePositionFromLayout(reroute: Reroute): void {
  void reroute.pos[0]
}

/**
 * Drops every layout entry a graph owns, including those inside the subgraph
 * definitions it holds. Mirrors `unregisterAllNodeStates`; call it from the
 * same places, before the entity containers are emptied.
 */
export function unregisterAllGraphLayout(
  graph: GraphLayoutOwner
): LayoutOperationResult {
  const registrations = trackAllGraphLayoutRegistrations(graph)
  const meta = canvasOperationMeta()
  for (const registration of registrations) {
    if (registration.entity === 'reroute' && registration.layout) {
      syncReroutePositionFromLayout(registration.instance)
    }
  }
  const operations = registrations.map((registration) =>
    createDeleteLayoutOperation(registration, meta)
  )
  for (const registration of registrations)
    clearLocalLayoutRegistration(registration)
  const result = layoutStore.applyOperations(operations)
  if (result === 'rejected') {
    for (const registration of registrations)
      restoreLocalLayoutRegistration(registration)
  }
  return result
}
