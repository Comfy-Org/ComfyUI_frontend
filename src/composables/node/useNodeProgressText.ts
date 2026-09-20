import { resolveNodeRootGraphId } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useTextPreviewWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

const TEXT_PREVIEW_WIDGET_NAME = '$$node-text-preview'

/**
 * Composable for handling node text previews
 */
export function useNodeProgressText() {
  const textPreviewWidget = useTextPreviewWidget()

  const findTextPreviewWidget = (node: LGraphNode) =>
    node.widgets?.find((w) => w.name === TEXT_PREVIEW_WIDGET_NAME)

  const addTextPreviewWidget = (node: LGraphNode) =>
    textPreviewWidget(node, {
      name: TEXT_PREVIEW_WIDGET_NAME,
      type: 'progressText'
    })

  /**
   * Shows text preview for a node
   * @param node The graph node to show the preview for
   */
  function showTextPreview(node: LGraphNode, text: string) {
    const widget = findTextPreviewWidget(node) ?? addTextPreviewWidget(node)
    widget.value = text
    node.setDirtyCanvas(true)
  }

  /**
   * Removes text preview from a node
   * @param node The graph node to remove the preview from
   */
  function removeTextPreview(node: LGraphNode) {
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === TEXT_PREVIEW_WIDGET_NAME
    )

    if (widgetIdx > -1) {
      node.widgets[widgetIdx].onRemove?.()
      node.widgets.splice(widgetIdx, 1)
      const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
      useWidgetValueStore().deleteWidget(
        widgetId(graphId, node.id, TEXT_PREVIEW_WIDGET_NAME)
      )
    }
  }

  return {
    showTextPreview,
    removeTextPreview
  }
}
