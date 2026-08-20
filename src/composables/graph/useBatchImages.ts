import { t } from '@/i18n'
import type { LGraphNode, Point } from '@/lib/litegraph/src/litegraph'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  BATCH_IMAGES_NODE_TYPE,
  resolveBatchImagesSelection
} from '@/utils/batchImagesUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { findNonOverlappingPosition } from '@/utils/mathUtil'

const BATCH_NODE_GAP = 100
const PLACEMENT_GAP = 20

/**
 * Wires image-producing nodes into a `BatchImagesNode`, either a freshly
 * created one or the batch node the user included in their selection.
 */
export function useBatchImages() {
  const canvasStore = useCanvasStore()

  const selectionForBatching = () =>
    resolveBatchImagesSelection(
      [...canvasStore.getCanvas().selectedItems].filter(isLGraphNode)
    )

  const connectImages = (sources: LGraphNode[], batchNode: LGraphNode) => {
    for (const source of sources) {
      const outputIndex = source.outputs.findIndex(
        (output) => output.type === 'IMAGE'
      )
      // Connecting the last free slot makes autogrow add the next one
      const inputIndex = batchNode.inputs.findIndex(
        (input) => input.link == null && input.type === 'IMAGE'
      )
      if (inputIndex === -1) break
      source.connect(outputIndex, batchNode, inputIndex)
    }
  }

  const clearOfOtherNodes = (node: LGraphNode, position: Point): Point => {
    const others =
      node.graph?.nodes.filter((other) => other.id !== node.id) ?? []
    return findNonOverlappingPosition(others, position, node.size, [
      0,
      node.size[1] + PLACEMENT_GAP
    ])
  }

  const selectOnly = (node: LGraphNode) => {
    const canvas = canvasStore.getCanvas()
    canvas.deselectAll()
    canvas.select(node)
    canvasStore.updateSelectedItems()
  }

  const batchSelectedImages = () => {
    const { target, sources } = selectionForBatching()
    if (target || sources.length < 2) return

    const nodeDef = useNodeDefStore().nodeDefsByName[BATCH_IMAGES_NODE_TYPE]
    if (!nodeDef) {
      useToastStore().add({
        severity: 'error',
        summary: t('toastMessages.batchImagesNodeUnavailable')
      })
      return
    }

    const right = Math.max(...sources.map((node) => node.pos[0] + node.size[0]))
    const centerY =
      sources.reduce((sum, node) => sum + node.pos[1] + node.size[1] / 2, 0) /
      sources.length

    const batchNode = useLitegraphService().addNodeOnGraph(nodeDef, {
      pos: [right + BATCH_NODE_GAP, centerY]
    })
    if (!batchNode) return

    connectImages(sources, batchNode)
    batchNode.pos = clearOfOtherNodes(batchNode, [
      right + BATCH_NODE_GAP,
      centerY - batchNode.size[1] / 2
    ])
    selectOnly(batchNode)
  }

  const addSelectedImagesToBatch = () => {
    const { target, sources } = selectionForBatching()
    if (!target || !sources.length) return

    connectImages(sources, target)
    selectOnly(target)
  }

  return { batchSelectedImages, addSelectedImagesToBatch }
}
