/**
 * Layout Mutations - Simplified Direct Operations
 *
 * Provides a clean API for layout operations that are CRDT-ready.
 * Operations are synchronous and applied directly to the store.
 */
import log from 'loglevel'

import { layoutStore } from '@/renderer/core/layout/store/LayoutStore'
import {
  LayoutSource,
  type NodeId,
  type NodeLayout,
  type Point,
  type Size
} from '@/renderer/core/layout/types'

const logger = log.getLogger('LayoutMutations')

export interface LayoutMutations {
  // Single node operations (synchronous, CRDT-ready)
  moveNode(nodeId: NodeId, position: Point): void
  resizeNode(nodeId: NodeId, size: Size): void
  setNodeZIndex(nodeId: NodeId, zIndex: number): void

  // Node lifecycle operations
  createNode(nodeId: NodeId, layout: Partial<NodeLayout>): void
  deleteNode(nodeId: NodeId): void

  // Link operations
  createLink(
    linkId: string | number,
    sourceNodeId: string | number,
    sourceSlot: number,
    targetNodeId: string | number,
    targetSlot: number
  ): void
  deleteLink(linkId: string | number): void

  // Reroute operations
  createReroute(
    rerouteId: string | number,
    position: Point,
    parentId?: string | number,
    linkIds?: (string | number)[]
  ): void
  deleteReroute(rerouteId: string | number): void
  moveReroute(
    rerouteId: string | number,
    position: Point,
    previousPosition: Point
  ): void

  // Stacking operations
  bringNodeToFront(nodeId: NodeId): void

  // Source tracking
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
  const moveNode = (nodeId: NodeId, position: Point): void => {
    const existing = layoutStore.getNodeLayoutRef(nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position,
      previousPosition: existing.position,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Resize a node
   */
  const resizeNode = (nodeId: NodeId, size: Size): void => {
    const existing = layoutStore.getNodeLayoutRef(nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'resizeNode',
      entity: 'node',
      nodeId,
      size,
      previousSize: existing.size,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Set node z-index
   */
  const setNodeZIndex = (nodeId: NodeId, zIndex: number): void => {
    const existing = layoutStore.getNodeLayoutRef(nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'setNodeZIndex',
      entity: 'node',
      nodeId,
      zIndex,
      previousZIndex: existing.zIndex,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Create a new node
   */
  const createNode = (nodeId: NodeId, layout: Partial<NodeLayout>): void => {
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
  const deleteNode = (nodeId: NodeId): void => {
    const existing = layoutStore.getNodeLayoutRef(nodeId).value
    if (!existing) return

    layoutStore.applyOperation({
      type: 'deleteNode',
      entity: 'node',
      nodeId,
      previousLayout: existing,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Bring a node to the front (highest z-index)
   */
  const bringNodeToFront = (nodeId: NodeId): void => {
    // Get all nodes to find the highest z-index
    const allNodes = layoutStore.getAllNodes().value
    let maxZIndex = 0

    for (const [, layout] of allNodes) {
      if (layout.zIndex > maxZIndex) {
        maxZIndex = layout.zIndex
      }
    }

    // Set this node's z-index to be one higher than the current max
    setNodeZIndex(nodeId, maxZIndex + 1)
  }

  /**
   * Create a new link
   */
  const createLink = (
    linkId: string | number,
    sourceNodeId: string | number,
    sourceSlot: number,
    targetNodeId: string | number,
    targetSlot: number
  ): void => {
    // Normalize node IDs to strings
    const normalizedSourceNodeId = String(sourceNodeId)
    const normalizedTargetNodeId = String(targetNodeId)

    logger.debug('Creating link:', {
      linkId: Number(linkId),
      from: `${normalizedSourceNodeId}[${sourceSlot}]`,
      to: `${normalizedTargetNodeId}[${targetSlot}]`
    })
    layoutStore.applyOperation({
      type: 'createLink',
      entity: 'link',
      linkId: Number(linkId),
      sourceNodeId: normalizedSourceNodeId,
      sourceSlot,
      targetNodeId: normalizedTargetNodeId,
      targetSlot,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Delete a link
   */
  const deleteLink = (linkId: string | number): void => {
    logger.debug('Deleting link:', Number(linkId))
    layoutStore.applyOperation({
      type: 'deleteLink',
      entity: 'link',
      linkId: Number(linkId),
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Create a new reroute
   */
  const createReroute = (
    rerouteId: string | number,
    position: Point,
    parentId?: string | number,
    linkIds: (string | number)[] = []
  ): void => {
    logger.debug('Creating reroute:', {
      rerouteId: Number(rerouteId),
      position,
      parentId: parentId != null ? Number(parentId) : undefined,
      linkCount: linkIds.length
    })
    layoutStore.applyOperation({
      type: 'createReroute',
      entity: 'reroute',
      rerouteId: Number(rerouteId),
      position,
      parentId: parentId != null ? Number(parentId) : undefined,
      linkIds: linkIds.map((id) => Number(id)),
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Delete a reroute
   */
  const deleteReroute = (rerouteId: string | number): void => {
    logger.debug('Deleting reroute:', Number(rerouteId))
    layoutStore.applyOperation({
      type: 'deleteReroute',
      entity: 'reroute',
      rerouteId: Number(rerouteId),
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Move a reroute
   */
  const moveReroute = (
    rerouteId: string | number,
    position: Point,
    previousPosition: Point
  ): void => {
    logger.debug('Moving reroute:', {
      rerouteId: Number(rerouteId),
      from: previousPosition,
      to: position
    })
    layoutStore.applyOperation({
      type: 'moveReroute',
      entity: 'reroute',
      rerouteId: Number(rerouteId),
      position,
      previousPosition,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  return {
    setSource,
    setActor,
    moveNode,
    resizeNode,
    setNodeZIndex,
    createNode,
    deleteNode,
    bringNodeToFront,
    createLink,
    deleteLink,
    createReroute,
    deleteReroute,
    moveReroute
  }
}
