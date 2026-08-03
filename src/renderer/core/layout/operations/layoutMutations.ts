/**
 * Layout Mutations - Simplified Direct Operations
 *
 * Provides a clean API for layout operations that are CRDT-ready.
 * Operations are synchronous and applied directly to the store.
 */
import log from 'loglevel'

import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { GroupId } from '@/types/groupId'
import type {
  GroupLayout,
  LayoutSource,
  NodeLayout,
  Point,
  RerouteId,
  Size
} from '@/renderer/core/layout/types'

const logger = log.getLogger('LayoutMutations')

interface LayoutMutations {
  moveNode(rootGraphId: UUID, nodeId: NodeId, position: Point): void
  batchMoveNodes(
    rootGraphId: UUID,
    updates: Array<{ nodeId: NodeId; position: Point }>
  ): void
  resizeNode(rootGraphId: UUID, nodeId: NodeId, size: Size): void
  setNodeZIndex(rootGraphId: UUID, nodeId: NodeId, zIndex: number): void
  createNode(
    rootGraphId: UUID,
    nodeId: NodeId,
    layout: Partial<NodeLayout>
  ): void
  deleteNode(rootGraphId: UUID, nodeId: NodeId): void

  // Reroute operations
  createReroute(rootGraphId: UUID, rerouteId: RerouteId, position: Point): void
  deleteReroute(rootGraphId: UUID, rerouteId: RerouteId): void
  moveReroute(rootGraphId: UUID, rerouteId: RerouteId, position: Point): void

  // Group operations
  createGroup(
    rootGraphId: UUID,
    groupId: GroupId,
    layout: Omit<GroupLayout, 'id'>
  ): void
  setGroupBounds(
    rootGraphId: UUID,
    groupId: GroupId,
    position: Point,
    size: Size
  ): void
  deleteGroup(rootGraphId: UUID, groupId: GroupId): void

  bringNodeToFront(rootGraphId: UUID, nodeId: NodeId): void
  setSource(source: LayoutSource): void
  setActor(actor: string): void
}

/**
 * Composable for accessing layout mutations with clean destructuring API
 */
export function useLayoutMutations(): LayoutMutations {
  /**
   * Set the current mutation source
   */
  const setSource = (source: LayoutSource): void => {
    layoutStore.setSource(source)
  }

  /**
   * Set the current actor (for CRDT)
   */
  const setActor = (actor: string): void => {
    layoutStore.setActor(actor)
  }

  /**
   * Move a node to a new position
   */
  const moveNode = (
    rootGraphId: UUID,
    nodeId: NodeId,
    position: Point
  ): void => {
    const existing = layoutStore.getNodeLayoutRef(rootGraphId, nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: rootGraphId,
      nodeId,
      position,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  function batchMoveNodes(
    rootGraphId: UUID,
    updates: Array<{ nodeId: NodeId; position: Point }>
  ): void {
    if (updates.length === 0) return

    const nodeBoundsUpdates = updates.flatMap(({ nodeId, position }) => {
      const existing = layoutStore.getNodeLayoutRef(rootGraphId, nodeId).value
      if (!existing) return []

      return [
        {
          nodeId,
          bounds: {
            x: position.x,
            y: position.y,
            width: existing.size.width,
            height: existing.size.height
          }
        }
      ]
    })

    if (nodeBoundsUpdates.length === 0) return
    layoutStore.batchUpdateNodeBounds(rootGraphId, nodeBoundsUpdates)
  }

  /**
   * Resize a node
   */
  const resizeNode = (rootGraphId: UUID, nodeId: NodeId, size: Size): void => {
    const existing = layoutStore.getNodeLayoutRef(rootGraphId, nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'resizeNode',
      entity: 'node',
      graphId: rootGraphId,
      nodeId,
      size,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Set node z-index
   */
  const setNodeZIndex = (
    rootGraphId: UUID,
    nodeId: NodeId,
    zIndex: number
  ): void => {
    const existing = layoutStore.getNodeLayoutRef(rootGraphId, nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'setNodeZIndex',
      entity: 'node',
      graphId: rootGraphId,
      nodeId,
      zIndex,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Create a new node
   */
  const createNode = (
    rootGraphId: UUID,
    nodeId: NodeId,
    layout: Partial<NodeLayout>
  ): void => {
    const fullLayout: NodeLayout = {
      id: nodeId,
      position: layout.position ?? { x: 0, y: 0 },
      size: layout.size ?? { width: 200, height: 100 },
      zIndex: layout.zIndex ?? 0,
      visible: layout.visible ?? true,
      bounds: {
        x: layout.position?.x ?? 0,
        y: layout.position?.y ?? 0,
        width: layout.size?.width ?? 200,
        height: layout.size?.height ?? 100
      }
    }

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: rootGraphId,
      nodeId,
      layout: fullLayout,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Delete a node
   */
  const deleteNode = (rootGraphId: UUID, nodeId: NodeId): void => {
    const existing = layoutStore.getNodeLayoutRef(rootGraphId, nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'deleteNode',
      entity: 'node',
      graphId: rootGraphId,
      nodeId,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Bring a node to the front (highest z-index)
   */
  const bringNodeToFront = (rootGraphId: UUID, nodeId: NodeId): void => {
    setNodeZIndex(rootGraphId, nodeId, layoutStore.allocateZIndex())
  }

  /**
   * Create a new reroute
   */
  const createReroute = (
    rootGraphId: UUID,
    rerouteId: RerouteId,
    position: Point
  ): void => {
    logger.debug('Creating reroute:', { rerouteId, position })
    layoutStore.applyOperation({
      type: 'createReroute',
      entity: 'reroute',
      graphId: rootGraphId,
      rerouteId,
      position,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  const createGroup = (
    rootGraphId: UUID,
    groupId: GroupId,
    layout: Omit<GroupLayout, 'id'>
  ): void => {
    layoutStore.applyOperation({
      type: 'createGroup',
      entity: 'group',
      graphId: rootGraphId,
      groupId,
      layout: { id: groupId, ...layout },
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  const setGroupBounds = (
    rootGraphId: UUID,
    groupId: GroupId,
    position: Point,
    size: Size
  ): void => {
    const existing = layoutStore.getGroupLayout(rootGraphId, groupId)
    if (!existing) return

    layoutStore.applyOperation({
      type: 'setGroupBounds',
      entity: 'group',
      graphId: rootGraphId,
      groupId,
      position,
      size,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  const deleteGroup = (rootGraphId: UUID, groupId: GroupId): void => {
    if (!layoutStore.getGroupLayout(rootGraphId, groupId)) return

    layoutStore.applyOperation({
      type: 'deleteGroup',
      entity: 'group',
      graphId: rootGraphId,
      groupId,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Delete a reroute
   */
  const deleteReroute = (rootGraphId: UUID, rerouteId: RerouteId): void => {
    if (!layoutStore.getRerouteLayout(rootGraphId, rerouteId)) return

    logger.debug('Deleting reroute:', rerouteId)
    layoutStore.applyOperation({
      type: 'deleteReroute',
      entity: 'reroute',
      graphId: rootGraphId,
      rerouteId,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Move a reroute
   */
  const moveReroute = (
    rootGraphId: UUID,
    rerouteId: RerouteId,
    position: Point
  ): void => {
    layoutStore.applyOperation({
      type: 'moveReroute',
      entity: 'reroute',
      graphId: rootGraphId,
      rerouteId,
      position,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  return {
    setSource,
    setActor,
    moveNode,
    batchMoveNodes,
    resizeNode,
    setNodeZIndex,
    createNode,
    deleteNode,
    bringNodeToFront,
    createReroute,
    deleteReroute,
    moveReroute,
    createGroup,
    setGroupBounds,
    deleteGroup
  }
}
