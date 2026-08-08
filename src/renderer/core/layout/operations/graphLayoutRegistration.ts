/**
 * Layout registration for litegraph entities.
 *
 * Geometry joins and leaves the layout store with the entity that owns it, so
 * every attach/detach path — including bulk teardown — goes through these
 * helpers rather than re-deriving the store writes by hand.
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
import { createUuidv4 } from '@/utils/uuid'

type GraphLayoutOwner = Pick<
  LGraph,
  '_nodes' | '_groups' | '_subgraphs' | 'reroutes' | 'rootGraph'
>

const groupRegistrationIds = new WeakMap<LGraphGroup, string>()
const nodeRegistrations = new WeakMap<
  LGraphNode,
  { graphId: UUID; nodeId: LGraphNode['id']; registrationId: string }
>()
const rerouteRegistrationIds = new WeakMap<Reroute, string>()

interface TrackedNodeLayoutRegistration {
  entity: 'node'
  graphId: UUID
  id: LGraphNode['id']
  instance: LGraphNode
  layout?: NonNullable<ReturnType<typeof layoutStore.getNodeLayoutRef>['value']>
  registrationId: string
}

interface TrackedGroupLayoutRegistration {
  entity: 'group'
  graphId: UUID
  id: LGraphGroup['id']
  instance: LGraphGroup
  layout?: NonNullable<ReturnType<typeof layoutStore.getGroupLayout>>
  registrationId: string
}

interface TrackedRerouteLayoutRegistration {
  entity: 'reroute'
  graphId: UUID
  id: Reroute['id']
  instance: Reroute
  layout?: NonNullable<ReturnType<typeof layoutStore.getRerouteLayout>>
  registrationId: string
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
  const { graphId, nodeId } = registration
  const storedLayout = layoutStore.getNodeLayoutRef(graphId, nodeId).value
  const layout =
    layoutStore.getRegistrationId('node', graphId, nodeId) ===
    registration.registrationId
      ? (storedLayout ?? undefined)
      : undefined
  return {
    entity: 'node',
    graphId,
    id: nodeId,
    instance: node,
    layout,
    registrationId: registration.registrationId
  }
}

function trackGroupLayoutRegistration(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup
): TrackedGroupLayoutRegistration | undefined {
  const registrationId = groupRegistrationIds.get(group)
  if (registrationId === undefined) return
  const graphId = graph.rootGraph.id
  const storedLayout = layoutStore.getGroupLayout(graphId, group.id)
  const layout =
    layoutStore.getRegistrationId('group', graphId, group.id) === registrationId
      ? (storedLayout ?? undefined)
      : undefined
  return {
    entity: 'group',
    graphId,
    id: group.id,
    instance: group,
    layout,
    registrationId
  }
}

function trackRerouteLayoutRegistration(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute
): TrackedRerouteLayoutRegistration | undefined {
  const registrationId = rerouteRegistrationIds.get(reroute)
  if (registrationId === undefined) return
  const graphId = graph.rootGraph.id
  const storedLayout = layoutStore.getRerouteLayout(graphId, reroute.id)
  const layout =
    layoutStore.getRegistrationId('reroute', graphId, reroute.id) ===
    registrationId
      ? (storedLayout ?? undefined)
      : undefined
  return {
    entity: 'reroute',
    graphId,
    id: reroute.id,
    instance: reroute,
    layout,
    registrationId
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
      const registration = trackGroupLayoutRegistration(owner, group)
      if (registration) registrations.push(registration)
    }
    for (const reroute of owner.reroutes.values()) {
      const registration = trackRerouteLayoutRegistration(owner, reroute)
      if (registration) registrations.push(registration)
    }
    for (const subgraph of owner._subgraphs.values()) track(subgraph)
  }
  track(graph)
  return registrations
}

function restoreLocalLayoutRegistration(
  registration: TrackedLayoutRegistration
): void {
  if (registration.entity === 'node') {
    nodeRegistrations.set(registration.instance, {
      graphId: registration.graphId,
      nodeId: registration.id,
      registrationId: registration.registrationId
    })
    registration.instance._layoutRegistered = true
    registration.instance._geometryVersion = layoutStore.geometryVersion
  } else if (registration.entity === 'group') {
    groupRegistrationIds.set(registration.instance, registration.registrationId)
  } else {
    rerouteRegistrationIds.set(
      registration.instance,
      registration.registrationId
    )
  }
}

function clearLocalLayoutRegistration(
  registration: TrackedLayoutRegistration
): void {
  if (registration.entity === 'node') {
    nodeRegistrations.delete(registration.instance)
    registration.instance._layoutRegistered = false
  } else if (registration.entity === 'group') {
    groupRegistrationIds.delete(registration.instance)
  } else {
    rerouteRegistrationIds.delete(registration.instance)
  }
}

function createDeleteLayoutOperation(
  registration: TrackedLayoutRegistration,
  meta = canvasOperationMeta()
): LayoutOperation {
  if (registration.entity === 'node') {
    return {
      ...meta,
      entity: 'node',
      graphId: registration.graphId,
      nodeId: registration.id,
      registrationId: registration.registrationId,
      type: 'deleteNode'
    }
  }
  if (registration.entity === 'group') {
    return {
      ...meta,
      entity: 'group',
      graphId: registration.graphId,
      groupId: registration.id,
      registrationId: registration.registrationId,
      type: 'deleteGroup'
    }
  }
  return {
    ...meta,
    entity: 'reroute',
    graphId: registration.graphId,
    registrationId: registration.registrationId,
    rerouteId: registration.id,
    type: 'deleteReroute'
  }
}

function createRestoreLayoutOperation(
  registration: TrackedLayoutRegistration,
  meta = canvasOperationMeta()
): LayoutOperation | undefined {
  if (!registration.layout) return
  if (registration.entity === 'node') {
    return {
      ...meta,
      entity: 'node',
      graphId: registration.graphId,
      layout: registration.layout,
      nodeId: registration.id,
      registrationId: registration.registrationId,
      type: 'createNode'
    }
  }
  if (registration.entity === 'group') {
    return {
      ...meta,
      entity: 'group',
      graphId: registration.graphId,
      groupId: registration.id,
      layout: registration.layout,
      registrationId: registration.registrationId,
      type: 'createGroup'
    }
  }
  return {
    ...meta,
    entity: 'reroute',
    graphId: registration.graphId,
    position: registration.layout.position,
    registrationId: registration.registrationId,
    rerouteId: registration.id,
    type: 'createReroute'
  }
}

function restoreGraphLayoutRegistration(
  registration: TrackedLayoutRegistration
): void {
  const operation = createRestoreLayoutOperation(registration)
  if (!operation) return
  try {
    if (layoutStore.applyOperation(operation) === 'applied')
      restoreLocalLayoutRegistration(registration)
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
      if (registration?.layout) restoreGraphLayoutRegistration(registration)
    }
  }
}

export function detachNodeLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode
): GraphLayoutDetach {
  return createGraphLayoutDetach(trackNodeLayoutRegistration(node), () =>
    unregisterNodeLayout(graph, node)
  )
}

export function detachGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup
): GraphLayoutDetach {
  return createGraphLayoutDetach(
    trackGroupLayoutRegistration(graph, group),
    () => unregisterGroupLayout(graph, group)
  )
}

export function detachRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute
): GraphLayoutDetach {
  return createGraphLayoutDetach(
    trackRerouteLayoutRegistration(graph, reroute),
    () => unregisterRerouteLayout(graph, reroute)
  )
}

export function attachNodeLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode,
  adoptExisting: boolean
): LayoutOperationResult {
  const result = registerNodeLayout(graph, node, createUuidv4())
  return result === 'no-op' && adoptExisting
    ? adoptExistingLayout(graph.rootGraph.id, {
        entity: 'node',
        id: node.id,
        instance: node
      })
    : result
}

export function attachGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup,
  adoptExisting = false
): LayoutOperationResult {
  const result = registerGroupLayout(graph, group, createUuidv4())
  return result === 'no-op' && adoptExisting
    ? adoptExistingLayout(graph.rootGraph.id, {
        entity: 'group',
        id: group.id,
        instance: group
      })
    : result
}

export function attachRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute,
  position: Point
): LayoutOperationResult {
  return registerRerouteLayout(graph, reroute, position, createUuidv4())
}

/** A newly attached node stacks above those already registered. */
export function registerNodeLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode,
  registrationId = createUuidv4()
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  const retained = nodeRegistrations.get(node)
  if (retained) {
    const cleanupResult = layoutStore.applyOperation({
      ...canvasOperationMeta(),
      entity: 'node',
      graphId: retained.graphId,
      nodeId: retained.nodeId,
      registrationId: retained.registrationId,
      type: 'deleteNode'
    })
    if (cleanupResult === 'rejected') return cleanupResult
    nodeRegistrations.delete(node)
  }

  const position = { x: node._pos[0], y: node._pos[1] }
  const size = { width: node._size[0], height: node._size[1] }
  nodeRegistrations.set(node, { graphId, nodeId: node.id, registrationId })
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
      registrationId,
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
  const registrationId = layoutStore.getRegistrationId(
    registration.entity,
    graphId,
    registration.id
  )
  if (registrationId === undefined) return 'no-op'

  if (registration.entity === 'node') {
    const { id, instance } = registration
    nodeRegistrations.set(instance, { graphId, nodeId: id, registrationId })
    instance._layoutRegistered = true
    instance._geometryVersion = layoutStore.geometryVersion
  } else if (registration.entity === 'group') {
    groupRegistrationIds.set(registration.instance, registrationId)
  } else {
    rerouteRegistrationIds.set(registration.instance, registrationId)
  }
  return 'applied'
}

export function transferNodeLayoutRegistration(
  node: LGraphNode,
  replacement: LGraphNode
): LayoutOperationResult {
  const registration = nodeRegistrations.get(node)
  if (!registration) return 'no-op'
  if (
    nodeRegistrations.has(replacement) ||
    registration.nodeId !== replacement.id ||
    layoutStore.getRegistrationId(
      'node',
      registration.graphId,
      registration.nodeId
    ) !== registration.registrationId
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

  return registerRerouteLayout(
    graph,
    reroute,
    { x: reroute.pos[0], y: reroute.pos[1] },
    createUuidv4()
  )
}

export function moveNodeLayout(node: LGraphNode, position: Point): void {
  const registration = nodeRegistrations.get(node)
  if (!registration) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: registration.graphId,
    nodeId: registration.nodeId,
    position,
    registrationId: registration.registrationId,
    type: 'moveNode'
  })
}

export function resizeNodeLayout(node: LGraphNode, size: Size): void {
  const registration = nodeRegistrations.get(node)
  if (!registration) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId: registration.graphId,
    nodeId: registration.nodeId,
    registrationId: registration.registrationId,
    size,
    type: 'resizeNode'
  })
}

export function unregisterNodeLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode,
  registrationId?: string
): LayoutOperationResult {
  const retainedRegistration = nodeRegistrations.get(node)
  const resolvedRegistrationId =
    registrationId !== undefined
      ? registrationId
      : retainedRegistration?.registrationId
  if (resolvedRegistrationId === undefined) return 'no-op'
  const ownsRetained =
    retainedRegistration?.registrationId === resolvedRegistrationId
  const nodeId = ownsRetained ? retainedRegistration.nodeId : node.id
  const graphId = ownsRetained
    ? retainedRegistration.graphId
    : graph.rootGraph.id

  if (ownsRetained) {
    layoutStore.readNodeRect(graphId, nodeId, node._posSize)
  }
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'node',
    graphId,
    nodeId,
    registrationId: resolvedRegistrationId,
    type: 'deleteNode'
  })
  if (
    result !== 'rejected' &&
    ownsRetained &&
    layoutStore.getRegistrationId('node', graphId, nodeId) !==
      resolvedRegistrationId
  ) {
    nodeRegistrations.delete(node)
    node._layoutRegistered = false
  }
  return result
}

export function registerGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup,
  registrationId: string
): LayoutOperationResult {
  const result = canvasLayoutMutations().createGroup(
    graph.rootGraph.id,
    group.id,
    {
      position: { x: group.pos[0], y: group.pos[1] },
      size: { width: group.size[0], height: group.size[1] }
    },
    registrationId
  )
  if (result === 'applied') groupRegistrationIds.set(group, registrationId)
  return result
}

export function unregisterGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup,
  registrationId?: string
): LayoutOperationResult {
  const retainedRegistrationId = groupRegistrationIds.get(group)
  const resolvedRegistrationId =
    registrationId !== undefined ? registrationId : retainedRegistrationId
  if (resolvedRegistrationId === undefined) return 'no-op'

  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId: graph.rootGraph.id,
    groupId: group.id,
    registrationId: resolvedRegistrationId,
    type: 'deleteGroup'
  })
  if (
    result !== 'rejected' &&
    retainedRegistrationId === resolvedRegistrationId &&
    layoutStore.getRegistrationId('group', graph.rootGraph.id, group.id) !==
      resolvedRegistrationId
  )
    groupRegistrationIds.delete(group)
  return result
}

export function setGroupBoundsLayout(
  graph: { rootGraph: { id: UUID } },
  group: LGraphGroup,
  position: Point,
  size: Size
): void {
  const registrationId = groupRegistrationIds.get(group)
  if (registrationId === undefined) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'group',
    graphId: graph.rootGraph.id,
    groupId: group.id,
    position,
    registrationId,
    size,
    type: 'setGroupBounds'
  })
}

export function unregisterRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute,
  registrationId?: string
): LayoutOperationResult {
  const retainedRegistrationId = rerouteRegistrationIds.get(reroute)
  const resolvedRegistrationId =
    registrationId !== undefined ? registrationId : retainedRegistrationId
  if (resolvedRegistrationId === undefined) return 'no-op'

  const graphId = graph.rootGraph.id
  const storedRegistrationId = layoutStore.getRegistrationId(
    'reroute',
    graphId,
    reroute.id
  )
  if (storedRegistrationId === resolvedRegistrationId) {
    syncReroutePositionFromLayout(reroute)
  }
  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId,
    registrationId: resolvedRegistrationId,
    rerouteId: reroute.id,
    type: 'deleteReroute'
  })
  if (
    result !== 'rejected' &&
    retainedRegistrationId === resolvedRegistrationId &&
    layoutStore.getRegistrationId('reroute', graphId, reroute.id) !==
      resolvedRegistrationId
  )
    rerouteRegistrationIds.delete(reroute)
  return result
}

export function registerRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute,
  position: Point,
  registrationId: string
): LayoutOperationResult {
  const result = canvasLayoutMutations().createReroute(
    graph.rootGraph.id,
    reroute.id,
    position,
    registrationId
  )
  if (result === 'applied') rerouteRegistrationIds.set(reroute, registrationId)
  return result
}

export function moveRerouteLayout(
  graph: { rootGraph: { id: UUID } },
  reroute: Reroute,
  position: Point
): void {
  const registrationId = rerouteRegistrationIds.get(reroute)
  if (registrationId === undefined) return
  layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId: graph.rootGraph.id,
    position,
    registrationId,
    rerouteId: reroute.id,
    type: 'moveReroute'
  })
}

export function hasRerouteLayoutRegistration(reroute: Reroute): boolean {
  return rerouteRegistrationIds.has(reroute)
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
  const result = layoutStore.applyOperations(operations)
  if (result === 'rejected') return result

  for (const registration of registrations)
    clearLocalLayoutRegistration(registration)
  return result
}
