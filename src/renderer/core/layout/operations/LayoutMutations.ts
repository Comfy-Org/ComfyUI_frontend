/**
 * Layout Mutations - Simplified Direct Operations
 *
 * Provides a clean API for layout operations that are CRDT-ready.
 * Operations are synchronous and applied directly to the store.
 */
import log from 'loglevel'

import { layoutStore } from '@/renderer/core/layout/store/LayoutStore'
import {
  type LayoutMutations,
  LayoutSource,
  type NodeId,
  type NodeLayout,
  type Point,
  type Size
} from '@/renderer/core/layout/types'

const logger = log.getLogger('LayoutMutations')

class LayoutMutationsImpl implements LayoutMutations {
  /**
   * Set the current mutation source
   */
  setSource(source: LayoutSource): void {
    layoutStore.setSource(source)
  }

  /**
   * Set the current actor (for CRDT)
   */
  setActor(actor: string): void {
    layoutStore.setActor(actor)
  }

  /**
   * Move a node to a new position
   */
  moveNode(nodeId: NodeId, position: Point): void {
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
  resizeNode(nodeId: NodeId, size: Size): void {
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
  setNodeZIndex(nodeId: NodeId, zIndex: number): void {
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
  createNode(nodeId: NodeId, layout: Partial<NodeLayout>): void {
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
  deleteNode(nodeId: NodeId): void {
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
  bringNodeToFront(nodeId: NodeId): void {
    // Get all nodes to find the highest z-index
    const allNodes = layoutStore.getAllNodes().value
    let maxZIndex = 0

    for (const [, layout] of allNodes) {
      if (layout.zIndex > maxZIndex) {
        maxZIndex = layout.zIndex
      }
    }

    // Set this node's z-index to be one higher than the current max
    this.setNodeZIndex(nodeId, maxZIndex + 1)
  }

  /**
   * Create a new link
   */
  createLink(
    linkId: string | number,
    sourceNodeId: string,
    sourceSlot: number,
    targetNodeId: string,
    targetSlot: number
  ): void {
    logger.debug('Creating link:', {
      linkId: Number(linkId),
      from: `${sourceNodeId}[${sourceSlot}]`,
      to: `${targetNodeId}[${targetSlot}]`
    })
    layoutStore.applyOperation({
      type: 'createLink',
      entity: 'link',
      linkId: Number(linkId),
      sourceNodeId,
      sourceSlot,
      targetNodeId,
      targetSlot,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })
  }

  /**
   * Delete a link
   */
  deleteLink(linkId: string | number): void {
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
  createReroute(
    rerouteId: string | number,
    position: Point,
    parentId?: string | number,
    linkIds: (string | number)[] = []
  ): void {
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
  deleteReroute(rerouteId: string | number): void {
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
  moveReroute(
    rerouteId: string | number,
    position: Point,
    previousPosition: Point
  ): void {
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
}

// Create singleton instance
export const layoutMutations = new LayoutMutationsImpl()
