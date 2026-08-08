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

type ScopedLayoutRegistration =
  | { entity: 'group'; graphId: UUID; id: LGraphGroup['id'] }
  | { entity: 'reroute'; graphId: UUID; id: Reroute['id'] }

function registrationKey({
  entity,
  graphId,
  id
}: ScopedLayoutRegistration): string {
  return `${entity}:${graphId}:${id}`
}

function reconcilePendingRegistration(
  registration: ScopedLayoutRegistration
): boolean {
  const { entity, graphId, id } = registration
  const key = registrationKey(registration)
  const registrationId = pendingRegistrations.get(key)
  if (registrationId === undefined) return true

  const storedId = layoutStore.getRegistrationId(entity, graphId, id)
  if (storedId === registrationId) {
    const result = layoutStore.applyOperation(
      entity === 'group'
        ? {
            ...canvasOperationMeta(),
            entity,
            graphId,
            groupId: id,
            registrationId,
            type: 'deleteGroup'
          }
        : {
            ...canvasOperationMeta(),
            entity,
            graphId,
            registrationId,
            rerouteId: id,
            type: 'deleteReroute'
          }
    )
    if (result === 'rejected') return false
  }
  pendingRegistrations.delete(key)
  return true
}

function registerScopedLayout(
  registration: ScopedLayoutRegistration & { registrationId: string },
  create: () => LayoutOperationResult,
  retain: () => void
): LayoutOperationResult {
  const key = registrationKey(registration)
  if (!reconcilePendingRegistration(registration)) return 'rejected'

  pendingRegistrations.set(key, registration.registrationId)
  const result = create()
  pendingRegistrations.delete(key)
  if (result === 'applied') retain()
  return result
}

function reconcilePendingGraph(graphId: UUID): LayoutOperationResult {
  const groupPrefix = `group:${graphId}:`
  const reroutePrefix = `reroute:${graphId}:`
  for (const key of [...pendingRegistrations.keys()]) {
    if (key.startsWith(groupPrefix)) {
      const groupId = toGroupId(Number(key.slice(groupPrefix.length)))
      if (
        !reconcilePendingRegistration({
          entity: 'group',
          graphId,
          id: groupId
        })
      )
        return 'rejected'
    } else if (key.startsWith(reroutePrefix)) {
      const rerouteId = toRerouteId(Number(key.slice(reroutePrefix.length)))
      if (
        !reconcilePendingRegistration({
          entity: 'reroute',
          graphId,
          id: rerouteId
        })
      )
        return 'rejected'
    }
  }
  return 'applied'
}

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

function reconcileLocalLayoutRegistration(
  registration: TrackedLayoutRegistration
): void {
  const { entity, graphId, id, registrationId } = registration
  const liveRegistrationId = layoutStore.getRegistrationId(entity, graphId, id)
  if (liveRegistrationId === registrationId) {
    restoreLocalLayoutRegistration(registration)
  } else {
    clearLocalLayoutRegistration(registration)
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
  let compensationError: unknown
  try {
    layoutStore.applyOperation(operation)
  } catch (error) {
    compensationError = error
  }

  reconcileLocalLayoutRegistration(registration)
  if (compensationError) throw compensationError
}

function retainCompensationError(
  error: unknown,
  compensationError: unknown,
  message = 'Layout teardown and compensation failed'
): void {
  if (!(error instanceof Error)) {
    console.error(message, { compensationError, primaryError: error })
    return
  }
  Object.defineProperty(error, 'cause', {
    configurable: true,
    value: new AggregateError([error.cause, compensationError], message)
  })
}

function restoreGraphLayoutRegistrations(
  registrations: readonly TrackedLayoutRegistration[],
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
  registration: TrackedLayoutRegistration | undefined,
  unregister: () => LayoutOperationResult
): GraphLayoutDetach {
  const registrations = registration?.layout ? [registration] : []
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
      registrations.push(
        ...trackAllGraphLayoutRegistrations(graph).filter(
          (registration) => registration.layout !== undefined
        )
      )
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

function compensateRegistration(error: unknown, unregister: () => void): never {
  try {
    unregister()
  } catch (compensationError) {
    retainCompensationError(
      error,
      compensationError,
      'Layout registration and compensation failed'
    )
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
  const registrationId = createUuidv4()
  let result: LayoutOperationResult
  try {
    result = registerGroupLayout(graph, group, registrationId)
  } catch (error) {
    compensateRegistration(error, () => {
      unregisterGroupLayout(graph, group, registrationId)
    })
  }
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

  const newRegistrationId = createUuidv4()
  try {
    return registerRerouteLayout(
      graph,
      reroute,
      { x: reroute.pos[0], y: reroute.pos[1] },
      newRegistrationId
    )
  } catch (error) {
    compensateRegistration(error, () => {
      unregisterRerouteLayout(graph, reroute, newRegistrationId)
    })
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
  return registerScopedLayout(
    { entity: 'group', graphId, id: group.id, registrationId },
    () =>
      canvasLayoutMutations().createGroup(
        graphId,
        group.id,
        {
          position: { x: group.pos[0], y: group.pos[1] },
          size: { width: group.size[0], height: group.size[1] }
        },
        registrationId
      ),
    () => groupRegistrationIds.set(group, registrationId)
  )
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
    const key = registrationKey({
      entity: 'group',
      graphId: graph.rootGraph.id,
      id: group.id
    })
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
  if (result !== 'rejected') {
    const key = registrationKey({ entity: 'reroute', graphId, id: reroute.id })
    const storedId = layoutStore.getRegistrationId(
      'reroute',
      graphId,
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
  return registerScopedLayout(
    { entity: 'reroute', graphId, id: reroute.id, registrationId },
    () =>
      canvasLayoutMutations().createReroute(
        graphId,
        reroute.id,
        position,
        registrationId
      ),
    () => rerouteRegistrationIds.set(reroute, registrationId)
  )
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
  if (graph.rootGraph) {
    const pendingResult = reconcilePendingGraph(graph.rootGraph.id)
    if (pendingResult === 'rejected') return pendingResult
  }
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
  const restorationOperations = registrations.flatMap((registration) => {
    const operation = createRestoreLayoutOperation(registration, meta)
    return operation ? [operation] : []
  })
  let result: LayoutOperationResult
  try {
    result = layoutStore.applyOperations(operations)
  } catch (error) {
    if (!(error instanceof LayoutOperationError) || !error.applied) throw error
    try {
      layoutStore.applyOperations(restorationOperations)
    } catch (compensationError) {
      retainCompensationError(error, compensationError)
    }
    for (const registration of registrations)
      reconcileLocalLayoutRegistration(registration)
    throw error
  }
  if (result === 'rejected') return result

  for (const registration of registrations)
    clearLocalLayoutRegistration(registration)
  return result
}
