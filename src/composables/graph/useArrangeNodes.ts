import { useSelectionState } from '@/composables/graph/useSelectionState'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { Point } from '@/renderer/core/layout/types'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

export type ArrangeLayout = 'vertical' | 'horizontal' | 'grid'

export const DEFAULT_ARRANGE_GAP = 12
export const MIN_ARRANGE_GAP = 0
export const MAX_ARRANGE_GAP = 48

interface NodeBox {
  id: NodeId
  posX: number
  posY: number
  visualWidth: number
  visualHeight: number
  titleHeight: number
}

interface ArrangeUpdate {
  nodeId: NodeId
  position: Point
}

const titleHeightOf = (node: LGraphNode): number => {
  const mode = node.title_mode
  if (mode === TitleMode.TRANSPARENT_TITLE || mode === TitleMode.NO_TITLE) {
    return 0
  }
  return LiteGraph.NODE_TITLE_HEIGHT
}

const toBox = (node: LGraphNode): NodeBox => {
  const titleHeight = titleHeightOf(node)
  return {
    id: node.id,
    posX: node.pos[0],
    posY: node.pos[1],
    visualWidth: node.size[0],
    visualHeight: node.size[1] + titleHeight,
    titleHeight
  }
}

const byTopDown = (a: NodeBox, b: NodeBox) => a.posY - b.posY || a.posX - b.posX

const byLeftRight = (a: NodeBox, b: NodeBox) =>
  a.posX - b.posX || a.posY - b.posY

const findAnchor = (boxes: NodeBox[]): NodeBox =>
  boxes.reduce((best, box) =>
    box.posX + box.posY < best.posX + best.posY ? box : best
  )

const cumulativeOffsets = (
  sizes: number[],
  origin: number,
  gap: number
): number[] => {
  const offsets: number[] = [origin]
  for (let i = 1; i < sizes.length; i++) {
    offsets.push(offsets[i - 1] + sizes[i - 1] + gap)
  }
  return offsets
}

const arrangeVertical = (
  boxes: NodeBox[],
  anchor: NodeBox,
  gap: number
): ArrangeUpdate[] => {
  const sorted = [...boxes].sort(byTopDown)
  let visualTop = anchor.posY - anchor.titleHeight
  return sorted.map((box) => {
    const update: ArrangeUpdate = {
      nodeId: box.id,
      position: { x: anchor.posX, y: visualTop + box.titleHeight }
    }
    visualTop += box.visualHeight + gap
    return update
  })
}

const arrangeHorizontal = (
  boxes: NodeBox[],
  anchor: NodeBox,
  gap: number
): ArrangeUpdate[] => {
  const sorted = [...boxes].sort(byLeftRight)
  const visualTop = anchor.posY - anchor.titleHeight
  let cursorX = anchor.posX
  return sorted.map((box) => {
    const update: ArrangeUpdate = {
      nodeId: box.id,
      position: { x: cursorX, y: visualTop + box.titleHeight }
    }
    cursorX += box.visualWidth + gap
    return update
  })
}

const arrangeGrid = (
  boxes: NodeBox[],
  anchor: NodeBox,
  gap: number
): ArrangeUpdate[] => {
  const sorted = [...boxes].sort(byTopDown)
  const cols = Math.ceil(Math.sqrt(sorted.length))
  const rows = Math.ceil(sorted.length / cols)

  const colWidths = new Array<number>(cols).fill(0)
  const rowHeights = new Array<number>(rows).fill(0)
  sorted.forEach((box, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    if (box.visualWidth > colWidths[col]) colWidths[col] = box.visualWidth
    if (box.visualHeight > rowHeights[row]) rowHeights[row] = box.visualHeight
  })

  const colX = cumulativeOffsets(colWidths, anchor.posX, gap)
  const rowVisualTop = cumulativeOffsets(
    rowHeights,
    anchor.posY - anchor.titleHeight,
    gap
  )

  return sorted.map((box, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      nodeId: box.id,
      position: {
        x: colX[col],
        y: rowVisualTop[row] + box.titleHeight
      }
    }
  })
}

export function computeArrangement(
  nodes: LGraphNode[],
  layout: ArrangeLayout,
  gap: number = DEFAULT_ARRANGE_GAP
): ArrangeUpdate[] {
  if (nodes.length < 2) return []
  const boxes = nodes.map(toBox)
  const anchor = findAnchor(boxes)
  if (layout === 'vertical') return arrangeVertical(boxes, anchor, gap)
  if (layout === 'horizontal') return arrangeHorizontal(boxes, anchor, gap)
  return arrangeGrid(boxes, anchor, gap)
}

interface ArrangeOptions {
  gap?: number
  captureUndo?: boolean
}

export function useArrangeNodes() {
  const { selectedNodes, hasMultipleSelection } = useSelectionState()
  const mutations = useLayoutMutations()
  const workflowStore = useWorkflowStore()

  const arrangeNodes = (
    layout: ArrangeLayout,
    { gap = DEFAULT_ARRANGE_GAP, captureUndo = true }: ArrangeOptions = {}
  ) => {
    if (!hasMultipleSelection.value) return
    const updates = computeArrangement(selectedNodes.value, layout, gap)
    if (updates.length === 0) return

    mutations.setSource(LayoutSource.Canvas)
    mutations.batchMoveNodes(updates)
    app.canvas?.setDirty(true, true)
    if (captureUndo) {
      workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
    }
  }

  return { arrangeNodes, canArrange: hasMultipleSelection }
}
