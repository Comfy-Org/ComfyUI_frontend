import type { LGraphNode } from '@comfyorg/litegraph'
import type { IWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { ANIM_PREVIEW_WIDGET } from '@/scripts/app'
import { createImageHost } from '@/scripts/ui/imagePreview'
import { fitDimensionsToNodeWidth } from '@/utils/imageUtil'

/**
 * Composable for handling animated image previews in nodes
 */
export function useNodeAnimatedImage() {
  /**
   * Shows animated image preview for a node
   * @param node The graph node to show the preview for
   */
  function showAnimatedPreview(node: LGraphNode) {
    if (!node.imgs?.length) return
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === ANIM_PREVIEW_WIDGET
    )

    if (widgetIdx > -1) {
      // Replace content in existing widget
      const widget = node.widgets[widgetIdx] as IWidget & {
        options: { host: ReturnType<typeof createImageHost> }
      }
      widget.options.host.updateImages(node.imgs)
    } else {
      // Create new widget
      const host = createImageHost(node)
      // @ts-expect-error host is not a standard DOM widget option.
      const widget = node.addDOMWidget(ANIM_PREVIEW_WIDGET, 'img', host.el, {
        host,
        // @ts-expect-error `getHeight` of image host returns void instead of number.
        getHeight: host.getHeight,
        onDraw: host.onDraw,
        hideOnZoom: false
      }) as IWidget & {
        options: { host: ReturnType<typeof createImageHost> }
      }
      widget.serialize = false
      widget.serializeValue = () => undefined
      widget.options.host.updateImages(node.imgs)
      widget.computeLayoutSize = () => {
        const img = widget.options.host.getCurrentImage()
        if (!img) return { minHeight: 0, minWidth: 0 }

        return fitDimensionsToNodeWidth(
          img.naturalWidth,
          img.naturalHeight,
          node.size?.[0] || 0
        )
      }
    }
  }

  /**
   * Removes animated image preview from a node
   * @param node The graph node to remove the preview from
   */
  function removeAnimatedPreview(node: LGraphNode) {
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === ANIM_PREVIEW_WIDGET
    )

    if (widgetIdx > -1) {
      node.widgets[widgetIdx].onRemove?.()
      node.widgets.splice(widgetIdx, 1)
    }
  }

  return {
    showAnimatedPreview,
    removeAnimatedPreview
  }
}
