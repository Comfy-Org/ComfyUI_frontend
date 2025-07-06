import type { LGraphNode } from '@comfyorg/litegraph'

import { useImagePreviewWidget } from '@/composables/widgets/useImagePreviewWidget'

const CANVAS_IMAGE_PREVIEW_WIDGET = '$$canvas-image-preview'

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

  return {
    showCanvasImagePreview,
    removeCanvasImagePreview
  }
}
