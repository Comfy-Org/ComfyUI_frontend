import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useImagePreviewWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImagePreviewWidget'

import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  isMediaPreviewWidgetName
} from '@/core/graph/subgraph/preview/mediaPreviewName'
import { chosenPreviewDisplay } from '@/systems/nodePreviewSystem'

/**
 * Composable for handling canvas image previews in nodes
 */
export function useNodeCanvasImagePreview() {
  const imagePreviewWidget = useImagePreviewWidget()
  /**
   * Shows canvas image preview for a node
   * @param node The graph node to show the preview for
   */
  function showCanvasImagePreview(node: LGraphNode) {
    if (!node.imgs?.length) return
    reserveCanvasImagePreview(node)
  }

  function reserveCanvasImagePreview(node: LGraphNode) {
    if (node.isSubgraphNode()) return

    if (!node.widgets?.find((w) => w.name === CANVAS_IMAGE_PREVIEW_WIDGET)) {
      imagePreviewWidget(node, {
        type: 'IMAGE_PREVIEW',
        name: CANVAS_IMAGE_PREVIEW_WIDGET
      })
    }
  }

  /**
   * Removes canvas image preview from a node
   * @param node The graph node to remove the preview from
   */
  function removeCanvasImagePreview(node: LGraphNode) {
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === CANVAS_IMAGE_PREVIEW_WIDGET
    )

    if (widgetIdx > -1) {
      node.widgets[widgetIdx].onRemove?.()
      node.widgets.splice(widgetIdx, 1)
    }
  }

  function removeCanvasMediaPreviews(node: LGraphNode) {
    const previews =
      node.widgets?.filter((w) => isMediaPreviewWidgetName(w.name)) ?? []
    for (const preview of previews) {
      preview.onRemove?.()
      node.widgets?.splice(node.widgets.indexOf(preview), 1)
    }
    if (node.videoContainer) {
      node.videoContainer = undefined
      node.images = undefined
    }
  }

  function applyPreviewDisplay(node: LGraphNode): boolean {
    const display = chosenPreviewDisplay(node)
    if (display === 'hidden') {
      removeCanvasMediaPreviews(node)
      return false
    }
    if (display === 'shown' && !node.animatedImages)
      reserveCanvasImagePreview(node)
    else if (!node.imgs?.length) removeCanvasImagePreview(node)
    return true
  }

  return {
    showCanvasImagePreview,
    reserveCanvasImagePreview,
    removeCanvasImagePreview,
    applyPreviewDisplay
  }
}
