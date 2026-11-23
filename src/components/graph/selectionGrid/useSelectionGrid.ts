import { clamp, mean } from 'es-toolkit'
import { computed } from 'vue'

import {
  computeTidyLayout,
  detectSelectionGrid,
  tidyGapOf
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  LayoutBox
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type {
  Point2D,
  PointTuple,
  Rect
} from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraph, LGraphNode, Reroute } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

function measureDrawnBox(
  node: LGraphNode,
  ctx: CanvasRenderingContext2D | undefined
): LayoutBox {
  const bounds: Rect = [0, 0, 0, 0]
  node.measure(bounds, ctx)
  node.onBounding?.(bounds)
  const [x, y, width, height] = bounds
  return { id: node.id, x, y, width, height }
}

function nodePositionForDrawnBoxAt(
  node: LGraphNode,
  { x, y }: BoxPosition,
  ctx: CanvasRenderingContext2D | undefined
) {
  const drawn = measureDrawnBox(node, ctx)
  return { x: x + node.pos[0] - drawn.x, y: y + node.pos[1] - drawn.y }
}

function progressBetween(
  from: PointTuple,
  to: PointTuple,
  at: PointTuple
): number {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return 0.5
  const projected =
    ((at[0] - from[0]) * dx + (at[1] - from[1]) * dy) / lengthSquared
  return clamp(projected, 0, 1)
}

function shiftAlongLink(
  graph: LGraph,
  reroute: Reroute,
  linkId: LinkId,
  shifts: Map<NodeId, Point2D>
): Point2D | undefined {
  const link = graph.links.get(linkId)
  if (!link) return undefined
  const from = graph.getNodeById(link.origin_id)
  const to = graph.getNodeById(link.target_id)
  const fromShift = shifts.get(link.origin_id)
  const toShift = shifts.get(link.target_id)
  if (!from || !to || !fromShift || !toShift) return undefined
  const t = progressBetween(
    from.getOutputPos(link.origin_slot),
    to.getInputPos(link.target_slot),
    reroute.pos
  )
  return {
    x: fromShift.x + (toShift.x - fromShift.x) * t,
    y: fromShift.y + (toShift.y - fromShift.y) * t
  }
}

function rerouteShift(
  graph: LGraph,
  reroute: Reroute,
  shifts: Map<NodeId, Point2D>
): Point2D | undefined {
  const linkShifts = [...reroute.linkIds].map((linkId) =>
    shiftAlongLink(graph, reroute, linkId, shifts)
  )
  if (!linkShifts.every((shift) => shift !== undefined)) return undefined
  return {
    x: mean(linkShifts.map((shift) => shift.x)),
    y: mean(linkShifts.map((shift) => shift.y))
  }
}

function enclosedReroutes(graph: LGraph, nodeIds: ReadonlySet<NodeId>) {
  return [...graph.reroutes.values()].filter(
    (reroute) =>
      reroute.floatingLinkIds.size === 0 &&
      reroute.linkIds.size > 0 &&
      [...reroute.linkIds].every((id) => {
        const link = graph.links.get(id)
        return (
          link && nodeIds.has(link.origin_id) && nodeIds.has(link.target_id)
        )
      })
  )
}

function moveEnclosedReroutes(
  graph: LGraph,
  shifts: Map<NodeId, Point2D>
): void {
  const moves = enclosedReroutes(graph, new Set(shifts.keys())).flatMap(
    (reroute) => {
      const shift = rerouteShift(graph, reroute, shifts)
      return shift && (shift.x !== 0 || shift.y !== 0)
        ? [{ reroute, shift }]
        : []
    }
  )
  for (const { reroute, shift } of moves) reroute.move(shift.x, shift.y)
}

export function useSelectionGrid() {
  const { selectedNodes } = useSelectionState()
  const mutations = useLayoutMutations(LayoutSource.Canvas)
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()

  const gridNodes = computed(() =>
    selectedNodes.value.filter((node) => !node.pinned)
  )
  const canTidy = computed(
    () => gridNodes.value.length >= 2 && !canvasStore.isReadOnly
  )

  const isMovable = (node: LGraphNode) =>
    !node.pinned && node.graph === canvasStore.canvas?.graph

  const measure = (nodes: LGraphNode[] = gridNodes.value): LayoutBox[] =>
    nodes
      .filter(isMovable)
      .map((node) => measureDrawnBox(node, canvasStore.canvas?.ctx))

  const recordUndoStep = () => {
    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
  }

  const capturePositions = (nodes: LGraphNode[]) => {
    const graph = canvasStore.currentGraph
    const positions = nodes.map((node) => ({
      node,
      position: { x: node.pos[0], y: node.pos[1] }
    }))
    const movableNodeIds = new Set(
      nodes.filter(isMovable).map((node) => node.id)
    )
    const reroutePositions = (
      graph ? enclosedReroutes(graph, movableNodeIds) : []
    ).map((reroute): [Reroute, PointTuple] => [reroute, [...reroute.pos]])
    return () => {
      if (!graph) return
      for (const [reroute, position] of reroutePositions) {
        if (graph.reroutes.get(reroute.id) === reroute) reroute.pos = position
      }
      const updates = positions
        .filter(({ node }) => graph.getNodeById(node.id) === node)
        .map(({ node, position }) => ({ nodeId: node.id, position }))
      mutations.batchMoveNodes(graph.rootGraph.id, updates)
      canvasStore.canvas?.setDirty(true, true)
    }
  }

  const placeBoxes = (
    nodes: LGraphNode[],
    positions: BoxPosition[]
  ): boolean => {
    const { rootGraphId } = canvasStore
    if (!rootGraphId) return false
    const nodesById = new Map(
      nodes.filter(isMovable).map((node) => [node.id, node])
    )
    const updates = positions.flatMap((position) => {
      const node = nodesById.get(position.id)
      if (!node) return []
      return [
        {
          nodeId: position.id,
          position: nodePositionForDrawnBoxAt(
            node,
            position,
            canvasStore.canvas?.ctx
          )
        }
      ]
    })

    if (updates.length === 0) return false
    const graph = canvasStore.canvas?.graph
    if (graph) {
      const targets = new Map(
        updates.map(({ nodeId, position }) => [nodeId, position])
      )
      const shifts = new Map(
        [...nodesById.values()].map((node): [NodeId, Point2D] => {
          const target = targets.get(node.id) ?? {
            x: node.pos[0],
            y: node.pos[1]
          }
          return [
            node.id,
            { x: target.x - node.pos[0], y: target.y - node.pos[1] }
          ]
        })
      )
      moveEnclosedReroutes(graph, shifts)
    }
    mutations.batchMoveNodes(rootGraphId, updates)
    canvasStore.canvas?.setDirty(true, true)
    return true
  }

  const moveBoxes = (
    nodes: LGraphNode[],
    positions: BoxPosition[],
    { captureUndo }: { captureUndo: boolean }
  ): boolean => {
    if (canvasStore.isReadOnly || !placeBoxes(nodes, positions)) return false
    if (captureUndo) recordUndoStep()
    return true
  }

  const tidyUp = (
    nodes: LGraphNode[] = gridNodes.value,
    { gap, captureUndo = true }: { gap?: number; captureUndo?: boolean } = {}
  ): number => {
    const grid = detectSelectionGrid(measure(nodes))
    const tidyGap = gap ?? tidyGapOf(grid)
    moveBoxes(nodes, computeTidyLayout(grid, tidyGap), { captureUndo })
    return tidyGap
  }

  return {
    gridNodes,
    canTidy,
    measure,
    capturePositions,
    moveBoxes,
    recordUndoStep,
    tidyUp
  }
}
