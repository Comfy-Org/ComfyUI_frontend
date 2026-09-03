import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

const IMAGE_WIDGET = 'image'

function imageWidgetId(node: LGraphNode): WidgetId | null {
  const graphId = node.graph?.rootGraph?.id
  return graphId ? widgetId(graphId, node.id, IMAGE_WIDGET) : null
}

export function readImageWidgetValue(node: LGraphNode): unknown {
  const id = imageWidgetId(node)
  const storedWidget = id ? useWidgetValueStore().getWidget(id) : undefined
  return storedWidget
    ? storedWidget.value
    : node.widgets?.find((w) => w.name === IMAGE_WIDGET)?.value
}

export function writeImageWidgetValue(node: LGraphNode, value: string): void {
  const id = imageWidgetId(node)
  if (!id || !useWidgetValueStore().setValue(id, value)) {
    const widget = node.widgets?.find((w) => w.name === IMAGE_WIDGET)
    if (!widget) return
    widget.value = value
  }
  if (node.properties) node.properties[IMAGE_WIDGET] = value
}
