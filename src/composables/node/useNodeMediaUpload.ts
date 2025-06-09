import type { LGraphNode } from '@comfyorg/litegraph'

import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import { useMediaLoaderWidget } from '@/composables/widgets/useMediaLoaderWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const MEDIA_LOADER_WIDGET_NAME = '$$node-media-loader'

interface MediaUploadOptions {
  fileFilter?: (file: File) => boolean
  onUploadComplete: (paths: string[]) => void
  allow_batch?: boolean
  accept?: string
}

/**
 * Composable for handling media upload with Vue MediaLoader widget
 */
export function useNodeMediaUpload() {
  const mediaLoaderWidget = useMediaLoaderWidget()

  const findMediaLoaderWidget = (node: LGraphNode) =>
    node.widgets?.find((w) => w.name === MEDIA_LOADER_WIDGET_NAME)

  const addMediaLoaderWidget = (
    node: LGraphNode,
    options: MediaUploadOptions
  ) => {
    // Set up the file upload handling using existing logic
    const { handleUpload } = useNodeImageUpload(node, options)

    // Create the MediaLoader widget
    const widget = mediaLoaderWidget(node, {
      name: MEDIA_LOADER_WIDGET_NAME,
      type: 'MEDIA_LOADER'
    } as InputSpec)

    // Connect the widget to the upload handler
    if (widget.options) {
      ;(widget.options as any).onFilesSelected = async (files: File[]) => {
        const paths = await Promise.all(files.map(handleUpload))
        const validPaths = paths.filter((p): p is string => !!p)
        if (validPaths.length) {
          options.onUploadComplete(validPaths)
        }
      }
    }

    return widget
  }

  /**
   * Shows media loader widget for a node
   * @param node The graph node to show the widget for
   * @param options Upload configuration options
   */
  function showMediaLoader(node: LGraphNode, options: MediaUploadOptions) {
    const widget =
      findMediaLoaderWidget(node) ?? addMediaLoaderWidget(node, options)
    node.setDirtyCanvas?.(true)
    return widget
  }

  /**
   * Removes media loader widget from a node
   * @param node The graph node to remove the widget from
   */
  function removeMediaLoader(node: LGraphNode) {
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === MEDIA_LOADER_WIDGET_NAME
    )

    if (widgetIdx > -1) {
      node.widgets[widgetIdx].onRemove?.()
      node.widgets.splice(widgetIdx, 1)
    }
  }

  return {
    showMediaLoader,
    removeMediaLoader,
    addMediaLoaderWidget
  }
}
