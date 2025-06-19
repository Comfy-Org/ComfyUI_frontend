import type { LGraphNode } from '@comfyorg/litegraph'

import { useImagePreviewWidget } from '@/composables/widgets/useImagePreviewWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const IMAGE_PREVIEW_WIDGET_NAME = '$$node-image-preview'

/**
 * Composable for handling node-level operations for ImagePreview widget
 */
export function useNodeImagePreview() {
  const imagePreviewWidget = useImagePreviewWidget()

  const findImagePreviewWidget = (node: LGraphNode) =>
    node.widgets?.find((w) => w.name === IMAGE_PREVIEW_WIDGET_NAME)

  const addImagePreviewWidget = (
    node: LGraphNode,
    inputSpec?: Partial<InputSpec>
  ) =>
    imagePreviewWidget(node, {
      name: IMAGE_PREVIEW_WIDGET_NAME,
      type: 'IMAGEPREVIEW',
      allow_batch: true,
      image_folder: 'input',
      ...inputSpec
    } as InputSpec)

  /**
   * Shows image preview widget for a node
   * @param node The graph node to show the widget for
   * @param images The images to display (can be single image or array)
   * @param options Configuration options
   */
  function showImagePreview(
    node: LGraphNode,
    images: string | string[],
    options: {
      allow_batch?: boolean
      image_folder?: string
      imageInputName?: string
    } = {}
  ) {
    const widget =
      findImagePreviewWidget(node) ??
      addImagePreviewWidget(node, {
        allow_batch: options.allow_batch,
        image_folder: options.image_folder || 'input'
      })

    // Set the widget value
    widget.value = images
    node.setDirtyCanvas?.(true)
  }

  /**
   * Removes image preview widget from a node
   * @param node The graph node to remove the widget from
   */
  function removeImagePreview(node: LGraphNode) {
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === IMAGE_PREVIEW_WIDGET_NAME
    )

    if (widgetIdx > -1) {
      node.widgets[widgetIdx].onRemove?.()
      node.widgets.splice(widgetIdx, 1)
    }
  }

  return {
    showImagePreview,
    removeImagePreview
  }
}
