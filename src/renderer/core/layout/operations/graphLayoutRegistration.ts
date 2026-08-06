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
import {
  LayoutOperationError,
  layoutStore
} from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  LayoutOperation,
  LayoutOperationResult,
  Point,
  Size
} from '@/renderer/core/layout/types'
import type { UUID } from '@/utils/uuid'
import { createUuidv4 } from '@/utils/uuid'
import { toGroupId } from '@/types/groupId'
import { toRerouteId } from '@/types/rerouteId'

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
const pendingRegistrations = new Map<string, string>()

function registrationKey(
  entity: 'group' | 'reroute',
  graphId: UUID,
  id: number
): string {
  return `${entity}:${graphId}:${id}`
}

function reconcilePendingRegistration(
  ...[key, entity, graphId, id, deleteRegistration]:
    | [
        key: string,
        entity: 'group',
        graphId: UUID,
        id: LGraphGroup['id'],
        deleteRegistration: (registrationId: string) => LayoutOperationResult
      ]
    | [
        key: string,
        entity: 'reroute',
        graphId: UUID,
        id: Reroute['id'],
        deleteRegistration: (registrationId: string) => LayoutOperationResult
      ]
): boolean {
  const registrationId = pendingRegistrations.get(key)
  if (registrationId === undefined) return true

  const storedId =
    entity === 'group'
      ? layoutStore.getRegistrationId(entity, graphId, id)
      : layoutStore.getRegistrationId(entity, graphId, id)
  if (storedId === registrationId) {
    const result = deleteRegistration(registrationId)
    if (result === 'rejected') return false
  }
  pendingRegistrations.delete(key)
  return true
}

function reconcilePendingGraph(graphId: UUID): LayoutOperationResult {
  for (const key of [...pendingRegistrations.keys()]) {
    const groupPrefix = `group:${graphId}:`
    const reroutePrefix = `reroute:${graphId}:`
    if (key.startsWith(groupPrefix)) {
      const groupId = toGroupId(Number(key.slice(groupPrefix.length)))
      if (
        !reconcilePendingRegistration(
          key,
          'group',
          graphId,
          groupId,
          (registrationId) =>
            layoutStore.applyOperation({
              ...canvasOperationMeta(),
              entity: 'group',
              graphId,
              groupId,
              registrationId,
              type: 'deleteGroup'
            })
        )
      )
        return 'rejected'
    } else if (key.startsWith(reroutePrefix)) {
      const rerouteId = toRerouteId(Number(key.slice(reroutePrefix.length)))
      if (
        !reconcilePendingRegistration(
          key,
          'reroute',
          graphId,
          rerouteId,
          (registrationId) =>
            layoutStore.applyOperation({
              ...canvasOperationMeta(),
              entity: 'reroute',
              graphId,
              registrationId,
              rerouteId,
              type: 'deleteReroute'
            })
        )
      )
        return 'rejected'
    }
  }
  return 'applied'
}

interface NodeLayoutRegistration {
  entity: 'node'
  graphId: UUID
  layout: NonNullable<ReturnType<typeof layoutStore.getNodeLayoutRef>['value']>
  node: LGraphNode
  nodeId: LGraphNode['id']
  registrationId: string
}

interface GroupLayoutRegistration {
  entity: 'group'
  graphId: UUID
  group: LGraphGroup
  layout: NonNullable<ReturnType<typeof layoutStore.getGroupLayout>>
  registrationId: string
}

interface RerouteLayoutRegistration {
  entity: 'reroute'
  graphId: UUID
  layout: NonNullable<ReturnType<typeof layoutStore.getRerouteLayout>>
  registrationId: string
  reroute: Reroute
}

export type GraphLayoutRegistration =
  | NodeLayoutRegistration
  | GroupLayoutRegistration
  | RerouteLayoutRegistration

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

export function captureNodeLayoutRegistration(
  node: LGraphNode
): NodeLayoutRegistration | undefined {
  const registration = nodeRegistrations.get(node)
  if (!registration) return
  const { graphId, nodeId } = registration
  const layout = layoutStore.getNodeLayoutRef(graphId, nodeId).value
  if (
    !layout ||
    layoutStore.getRegistrationId('node', graphId, nodeId) !==
      registration.registrationId
  )
    return
  return { entity: 'node', layout, node, ...registration }
}

export function captureGroupLayoutRegistration(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup
): GroupLayoutRegistration | undefined {
  const registrationId = groupRegistrationIds.get(group)
  if (registrationId === undefined) return
  const graphId = graph.rootGraph.id
  const layout = layoutStore.getGroupLayout(graphId, group.id)
  if (
    !layout ||
    layoutStore.getRegistrationId('group', graphId, group.id) !== registrationId
  )
    return
  return { entity: 'group', graphId, group, layout, registrationId }
}

export function captureRerouteLayoutRegistration(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute
): RerouteLayoutRegistration | undefined {
  const registrationId = rerouteRegistrationIds.get(reroute)
  if (registrationId === undefined) return
  const graphId = graph.rootGraph.id
  const layout = layoutStore.getRerouteLayout(graphId, reroute.id)
  if (
    !layout ||
    layoutStore.getRegistrationId('reroute', graphId, reroute.id) !==
      registrationId
  )
    return
  return { entity: 'reroute', graphId, layout, registrationId, reroute }
}

export function captureAllGraphLayoutRegistrations(
  graph: GraphLayoutOwner
): GraphLayoutRegistration[] {
  const registrations: GraphLayoutRegistration[] = []
  const visited = new Set<GraphLayoutOwner>()
  function capture(owner: GraphLayoutOwner): void {
    if (visited.has(owner)) return
    visited.add(owner)
    for (const node of owner._nodes) {
      const registration = captureNodeLayoutRegistration(node)
      if (registration) registrations.push(registration)
    }
    for (const group of owner._groups) {
      const registration = captureGroupLayoutRegistration(owner, group)
      if (registration) registrations.push(registration)
    }
    for (const reroute of owner.reroutes.values()) {
      const registration = captureRerouteLayoutRegistration(owner, reroute)
      if (registration) registrations.push(registration)
    }
    for (const subgraph of owner._subgraphs.values()) capture(subgraph)
  }
  capture(graph)
  return registrations
}

export function restoreGraphLayoutRegistration(
  registration: GraphLayoutRegistration
): void {
  let compensationError: unknown
  try {
    if (registration.entity === 'node') {
      if (
        !layoutStore.getNodeLayoutRef(registration.graphId, registration.nodeId)
          .value
      ) {
        layoutStore.applyOperation({
          ...canvasOperationMeta(),
          entity: 'node',
          graphId: registration.graphId,
          layout: registration.layout,
          nodeId: registration.nodeId,
          registrationId: registration.registrationId,
          type: 'createNode'
        })
      }
    } else if (registration.entity === 'group') {
      if (
        !layoutStore.getGroupLayout(registration.graphId, registration.group.id)
      ) {
        layoutStore.applyOperation({
          ...canvasOperationMeta(),
          entity: 'group',
          graphId: registration.graphId,
          groupId: registration.group.id,
          layout: registration.layout,
          registrationId: registration.registrationId,
          type: 'createGroup'
        })
      }
    } else if (
      !layoutStore.getRerouteLayout(
        registration.graphId,
        registration.reroute.id
      )
    ) {
      layoutStore.applyOperation({
        ...canvasOperationMeta(),
        entity: 'reroute',
        graphId: registration.graphId,
        position: registration.layout.position,
        registrationId: registration.registrationId,
        rerouteId: registration.reroute.id,
        type: 'createReroute'
      })
    }
  } catch (error) {
    compensationError = error
  }

  if (registration.entity === 'node') {
    nodeRegistrations.set(registration.node, {
      graphId: registration.graphId,
      nodeId: registration.nodeId,
      registrationId: registration.registrationId
    })
    registration.node._layoutRegistered = true
    registration.node._geometryVersion = layoutStore.geometryVersion
  } else if (registration.entity === 'group') {
    groupRegistrationIds.set(registration.group, registration.registrationId)
  } else {
    rerouteRegistrationIds.set(
      registration.reroute,
      registration.registrationId
    )
  }
  if (compensationError) throw compensationError
}

function retainCompensationError(
  error: unknown,
  compensationError: unknown
): void {
  if (!(error instanceof Error)) return
  Object.defineProperty(error, 'cause', {
    configurable: true,
    value: new AggregateError(
      [error.cause, compensationError],
      'Layout teardown and compensation failed'
    )
  })
}

export function restoreGraphLayoutRegistrations(
  registrations: readonly GraphLayoutRegistration[],
  primaryError: unknown
): void {
  for (const registration of registrations) {
    try {
      restoreGraphLayoutRegistration(registration)
    } catch (compensationError) {
      retainCompensationError(primaryError, compensationError)
    }
  }
}

export interface GraphLayoutDetach {
  readonly result: LayoutOperationResult
  includeGraph(graph: GraphLayoutOwner): void
  restore(primaryError: unknown): void
}

function createGraphLayoutDetach(
  registration: GraphLayoutRegistration | undefined,
  unregister: () => LayoutOperationResult
): GraphLayoutDetach {
  const registrations = registration ? [registration] : []
  let result: LayoutOperationResult
  try {
    result = unregister()
  } catch (error) {
    restoreGraphLayoutRegistrations(registrations, error)
    throw error
  }
  return {
    result,
    includeGraph(graph) {
      registrations.push(...captureAllGraphLayoutRegistrations(graph))
    },
    restore(primaryError) {
      restoreGraphLayoutRegistrations(registrations, primaryError)
    }
  }
}

export function detachNodeLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode
): GraphLayoutDetach {
  return createGraphLayoutDetach(captureNodeLayoutRegistration(node), () =>
    unregisterNodeLayout(graph, node)
  )
}

export function detachGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup
): GraphLayoutDetach {
  return createGraphLayoutDetach(
    captureGroupLayoutRegistration(graph, group),
    () => unregisterGroupLayout(graph, group)
  )
}

export function detachRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute
): GraphLayoutDetach {
  return createGraphLayoutDetach(
    captureRerouteLayoutRegistration(graph, reroute),
    () => unregisterRerouteLayout(graph, reroute)
  )
}

function compensateRegistration(error: unknown, unregister: () => void): never {
  try {
    unregister()
  } catch (compensationError) {
    if (error instanceof Error) {
      Object.defineProperty(error, 'cause', {
        configurable: true,
        value: new AggregateError(
          [error.cause, compensationError],
          'Layout registration and compensation failed'
        )
      })
    }
  }
  throw error
}

export function attachNodeLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode,
  adoptExisting: boolean
): LayoutOperationResult {
  const registrationId = createUuidv4()
  let result: LayoutOperationResult
  try {
    result = registerNodeLayout(graph, node, registrationId)
  } catch (error) {
    compensateRegistration(error, () => {
      unregisterNodeLayout(graph, node, registrationId)
    })
  }
  return result === 'no-op' && adoptExisting
    ? adoptNodeLayout(graph, node)
    : result
}

export function attachGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup
): LayoutOperationResult {
  const registrationId = createUuidv4()
  try {
    return registerGroupLayout(graph, group, registrationId)
  } catch (error) {
    compensateRegistration(error, () => {
      unregisterGroupLayout(graph, group, registrationId)
    })
  }
}

export function attachRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute,
  position: Point
): LayoutOperationResult {
  const registrationId = createUuidv4()
  try {
    return registerRerouteLayout(graph, reroute, position, registrationId)
  } catch (error) {
    compensateRegistration(error, () => {
      unregisterRerouteLayout(graph, reroute, registrationId)
    })
  }
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
  const result = layoutStore.applyOperation({
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
  if (result === 'applied') {
    node._layoutRegistered = true
    node._geometryVersion = layoutStore.geometryVersion
  } else {
    nodeRegistrations.delete(node)
  }
  return result
}

export function adoptNodeLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  const registrationId = layoutStore.getRegistrationId('node', graphId, node.id)
  if (registrationId === undefined) return 'no-op'

  nodeRegistrations.set(node, { graphId, nodeId: node.id, registrationId })
  node._layoutRegistered = true
  node._geometryVersion = layoutStore.geometryVersion
  return 'applied'
}

export function materializeRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute
): LayoutOperationResult {
  const registrationId = layoutStore.getRegistrationId(
    'reroute',
    graph.rootGraph.id,
    reroute.id
  )
  if (registrationId !== undefined) {
    rerouteRegistrationIds.set(reroute, registrationId)
    return 'applied'
  }

  const newRegistrationId = createUuidv4()
  try {
    return registerRerouteLayout(
      graph,
      reroute,
      { x: reroute.pos[0], y: reroute.pos[1] },
      newRegistrationId
    )
  } catch (error) {
    try {
      unregisterRerouteLayout(graph, reroute, newRegistrationId)
    } catch (compensationError) {
      if (error instanceof Error) {
        Object.defineProperty(error, 'cause', {
          configurable: true,
          value: new AggregateError(
            [error.cause, compensationError],
            'Layout registration and compensation failed'
          )
        })
      }
    }
    throw error
  }
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
  const graphId = graph.rootGraph.id
  const key = registrationKey('group', graphId, group.id)
  if (
    !reconcilePendingRegistration(
      key,
      'group',
      graphId,
      group.id,
      (pendingId) =>
        layoutStore.applyOperation({
          ...canvasOperationMeta(),
          entity: 'group',
          graphId,
          groupId: group.id,
          registrationId: pendingId,
          type: 'deleteGroup'
        })
    )
  )
    return 'rejected'
  pendingRegistrations.set(key, registrationId)
  const result = canvasLayoutMutations().createGroup(
    graphId,
    group.id,
    {
      position: { x: group.pos[0], y: group.pos[1] },
      size: { width: group.size[0], height: group.size[1] }
    },
    registrationId
  )
  if (result === 'applied') {
    pendingRegistrations.delete(key)
    groupRegistrationIds.set(group, registrationId)
  } else pendingRegistrations.delete(key)
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
  if (result !== 'rejected') {
    const key = registrationKey('group', graph.rootGraph.id, group.id)
    const storedId = layoutStore.getRegistrationId(
      'group',
      graph.rootGraph.id,
      group.id
    )
    if (
      pendingRegistrations.get(key) === resolvedRegistrationId &&
      storedId !== resolvedRegistrationId
    )
      pendingRegistrations.delete(key)
    if (
      retainedRegistrationId === resolvedRegistrationId &&
      storedId !== resolvedRegistrationId
    )
      groupRegistrationIds.delete(group)
  }
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

  const result = layoutStore.applyOperation({
    ...canvasOperationMeta(),
    entity: 'reroute',
    graphId: graph.rootGraph.id,
    registrationId: resolvedRegistrationId,
    rerouteId: reroute.id,
    type: 'deleteReroute'
  })
  if (result !== 'rejected') {
    const key = registrationKey('reroute', graph.rootGraph.id, reroute.id)
    const storedId = layoutStore.getRegistrationId(
      'reroute',
      graph.rootGraph.id,
      reroute.id
    )
    if (
      pendingRegistrations.get(key) === resolvedRegistrationId &&
      storedId !== resolvedRegistrationId
    )
      pendingRegistrations.delete(key)
    if (
      retainedRegistrationId === resolvedRegistrationId &&
      storedId !== resolvedRegistrationId
    )
      rerouteRegistrationIds.delete(reroute)
  }
  return result
}

export function registerRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute,
  position: Point,
  registrationId: string
): LayoutOperationResult {
  const graphId = graph.rootGraph.id
  const key = registrationKey('reroute', graphId, reroute.id)
  if (
    !reconcilePendingRegistration(
      key,
      'reroute',
      graphId,
      reroute.id,
      (pendingId) =>
        layoutStore.applyOperation({
          ...canvasOperationMeta(),
          entity: 'reroute',
          graphId,
          registrationId: pendingId,
          rerouteId: reroute.id,
          type: 'deleteReroute'
        })
    )
  )
    return 'rejected'
  pendingRegistrations.set(key, registrationId)
  const result = canvasLayoutMutations().createReroute(
    graphId,
    reroute.id,
    position,
    registrationId
  )
  if (result === 'applied') {
    pendingRegistrations.delete(key)
    rerouteRegistrationIds.set(reroute, registrationId)
  } else pendingRegistrations.delete(key)
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

/**
 * Drops every layout entry a graph owns, including those inside the subgraph
 * definitions it holds. Mirrors `unregisterAllNodeStates`; call it from the
 * same places, before the entity containers are emptied.
 *
 * Nodes go through `unregisterNodeLayout` so each one clears the flag its
 * geometry projection reads; deleting the entry alone would leave the node
 * believing it is still registered.
 */
export function unregisterAllGraphLayout(
  graph: GraphLayoutOwner
): LayoutOperationResult {
  if (graph.rootGraph) {
    const pendingResult = reconcilePendingGraph(graph.rootGraph.id)
    if (pendingResult === 'rejected') return pendingResult
  }
  const owners: GraphLayoutOwner[] = []
  const visited = new Set<GraphLayoutOwner>()
  function collectOwners(owner: GraphLayoutOwner): void {
    if (visited.has(owner)) return
    visited.add(owner)
    owners.push(owner)
    for (const subgraph of owner._subgraphs.values()) collectOwners(subgraph)
  }
  collectOwners(graph)

  layoutStore.setSource(LayoutSource.Canvas)
  const timestamp = Date.now()
  const actor = layoutStore.getCurrentActor()
  const source = layoutStore.getCurrentSource()
  const restorationOperations: LayoutOperation[] = []
  const operations: LayoutOperation[] = owners.flatMap((owner) => [
    ...owner._nodes.flatMap((node): LayoutOperation[] => {
      const registration = nodeRegistrations.get(node)
      if (registration === undefined) return []
      const { graphId, nodeId } = registration
      const layout = layoutStore.getNodeLayoutRef(graphId, nodeId).value
      const storedRegistrationId = layoutStore.getRegistrationId(
        'node',
        graphId,
        nodeId
      )
      if (layout && storedRegistrationId === registration.registrationId) {
        restorationOperations.push({
          actor,
          entity: 'node',
          graphId,
          layout,
          nodeId,
          registrationId: registration.registrationId,
          source,
          timestamp,
          type: 'createNode'
        })
      }
      return [
        {
          actor,
          entity: 'node',
          graphId,
          nodeId,
          registrationId: registration.registrationId,
          source,
          timestamp,
          type: 'deleteNode'
        }
      ]
    }),
    ...owner._groups.flatMap((group): LayoutOperation[] => {
      const registrationId = groupRegistrationIds.get(group)
      if (registrationId === undefined) return []
      const graphId = owner.rootGraph.id
      const layout = layoutStore.getGroupLayout(graphId, group.id)
      const storedRegistrationId = layoutStore.getRegistrationId(
        'group',
        graphId,
        group.id
      )
      if (layout && storedRegistrationId === registrationId) {
        restorationOperations.push({
          actor,
          entity: 'group',
          graphId,
          groupId: group.id,
          layout,
          registrationId,
          source,
          timestamp,
          type: 'createGroup'
        })
      }
      return [
        {
          actor,
          entity: 'group',
          graphId,
          groupId: group.id,
          registrationId,
          source,
          timestamp,
          type: 'deleteGroup'
        }
      ]
    }),
    ...[...owner.reroutes.values()].flatMap((reroute): LayoutOperation[] => {
      const registrationId = rerouteRegistrationIds.get(reroute)
      if (registrationId === undefined) return []
      const graphId = owner.rootGraph.id
      const layout = layoutStore.getRerouteLayout(graphId, reroute.id)
      const storedRegistrationId = layoutStore.getRegistrationId(
        'reroute',
        graphId,
        reroute.id
      )
      if (layout && storedRegistrationId === registrationId) {
        restorationOperations.push({
          actor,
          entity: 'reroute',
          graphId,
          position: layout.position,
          registrationId,
          rerouteId: reroute.id,
          source,
          timestamp,
          type: 'createReroute'
        })
      }
      return [
        {
          actor,
          entity: 'reroute',
          graphId,
          registrationId,
          rerouteId: reroute.id,
          source,
          timestamp,
          type: 'deleteReroute'
        }
      ]
    })
  ])
  let result: LayoutOperationResult
  try {
    result = layoutStore.applyOperations(operations)
  } catch (error) {
    if (!(error instanceof LayoutOperationError) || !error.applied) throw error
    try {
      layoutStore.applyOperations(restorationOperations)
    } catch (compensationError) {
      Object.defineProperty(error, 'cause', {
        configurable: true,
        value: new AggregateError(
          [error.cause, compensationError],
          'Layout teardown and compensation failed'
        )
      })
    }
    throw error
  }
  if (result === 'rejected') return result

  for (const owner of owners) {
    for (const node of owner._nodes) {
      nodeRegistrations.delete(node)
      node._layoutRegistered = false
    }
    for (const group of owner._groups) groupRegistrationIds.delete(group)
    for (const reroute of owner.reroutes.values())
      rerouteRegistrationIds.delete(reroute)
  }
  return result
}
