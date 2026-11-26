import { clamp, mean } from 'es-toolkit'
import { computed } from 'vue'

import {
  computeTidyLayout,
  detectSelectionGrid,
  tidyGapOf
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  LayoutBox,
  SelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type {
  Point2D,
  PointTuple,
  Rect
} from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraph, LGraphNode, Reroute } from '@comfyorg/litegraph/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@comfyorg/graph-state/layout/layoutMutations'
import { LayoutSource } from '@comfyorg/graph-state/layout/types'

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

interface ReroutePreview {
  original: PointTuple
  last: PointTuple
  sockets: Map<LinkId, [PointTuple, PointTuple]>
}

function positionAlongLink(
  graph: LGraph,
  linkId: LinkId,
  shifts: Map<NodeId, Point2D>,
  preview: ReroutePreview
): Point2D | undefined {
  const link = graph.links.get(linkId)
  if (!link) return undefined
  const from = graph.getNodeById(link.origin_id)
  const to = graph.getNodeById(link.target_id)
  const fromShift = shifts.get(link.origin_id)
  const toShift = shifts.get(link.target_id)
  if (!from || !to || !fromShift || !toShift) return undefined
  const start = from.getOutputPos(link.origin_slot)
  const end = to.getInputPos(link.target_slot)
  const sockets: [PointTuple, PointTuple] = preview.sockets.get(linkId) ?? [
    [...start],
    [...end]
  ]
  preview.sockets.set(linkId, sockets)
  return projectReroute(
    preview.original,
    sockets,
    [start[0] + fromShift.x, start[1] + fromShift.y],
    [end[0] + toShift.x, end[1] + toShift.y]
  )
}

function projectReroute(
  [x, y]: PointTuple,
  [originalStart, originalEnd]: [PointTuple, PointTuple],
  start: PointTuple,
  end: PointTuple
): Point2D {
  const dx = originalEnd[0] - originalStart[0]
  const dy = originalEnd[1] - originalStart[1]
  const ox = x - originalStart[0]
  const oy = y - originalStart[1]
  const squaredLength = dx * dx + dy * dy
  const t = squaredLength
    ? clamp((ox * dx + oy * dy) / squaredLength, 0, 1)
    : 0.5
  const targetDx = end[0] - start[0]
  const targetDy = end[1] - start[1]
  const rotation =
    targetDx || targetDy
      ? Math.atan2(targetDy, targetDx) - Math.atan2(dy, dx)
      : 0
  const offsetX = ox - t * dx
  const offsetY = oy - t * dy
  return {
    x:
      start[0] +
      t * targetDx +
      offsetX * Math.cos(rotation) -
      offsetY * Math.sin(rotation),
    y:
      start[1] +
      t * targetDy +
      offsetX * Math.sin(rotation) +
      offsetY * Math.cos(rotation)
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
  shifts: Map<NodeId, Point2D>,
  previews: Map<Reroute, ReroutePreview> | undefined
): void {
  for (const reroute of enclosedReroutes(graph, new Set(shifts.keys()))) {
    const [x, y] = reroute.pos
    const existing = previews?.get(reroute)
    if (existing && (x !== existing.last[0] || y !== existing.last[1])) continue
    const preview: ReroutePreview = existing ?? {
      original: [x, y],
      last: [x, y],
      sockets: new Map()
    }
    const targets = [...reroute.linkIds].map((linkId) =>
      positionAlongLink(graph, linkId, shifts, preview)
    )
    if (!targets.every((target) => target !== undefined)) continue
    const nextX = mean(targets.map((target) => target.x))
    const nextY = mean(targets.map((target) => target.y))
    if (Math.abs(nextX - x) < 1e-9 && Math.abs(nextY - y) < 1e-9) continue
    reroute.pos = [nextX, nextY]
    preview.last = [...reroute.pos]
    previews?.set(reroute, preview)
  }
}

export function useSelectionGrid() {
  const { selectedNodes } = useSelectionState()
  const mutations = useLayoutMutations(LayoutSource.Canvas)
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()
  let previewReroutes: Map<Reroute, ReroutePreview> | undefined

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
    const reroutes = new Map<Reroute, ReroutePreview>()
    previewReroutes = reroutes
    return (action: 'rollback' | 'commit' = 'rollback') => {
      if (previewReroutes === reroutes) previewReroutes = undefined
      if (!graph || action === 'commit') return
      for (const [reroute, { original, last }] of reroutes) {
        if (
          graph.reroutes.get(reroute.id) === reroute &&
          reroute.pos[0] === last[0] &&
          reroute.pos[1] === last[1]
        ) {
          reroute.pos = original
        }
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
      moveEnclosedReroutes(graph, shifts, previewReroutes)
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
    {
      gap,
      captureUndo = true,
      grid = detectSelectionGrid(measure(nodes))
    }: { gap?: number; captureUndo?: boolean; grid?: SelectionGrid } = {}
  ): number => {
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
