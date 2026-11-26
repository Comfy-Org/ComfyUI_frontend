import type { LGraph, LGraphNode } from '@comfyorg/litegraph/litegraph'
import { ComponentWidgetImpl, DOMWidgetImpl } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import type { BaseDOMWidget } from '@comfyorg/litegraph/types/domWidget'
import { forEachNode } from '@comfyorg/litegraph/utils/graphTraversalUtil'

function domWidgetsOf(node: LGraphNode): BaseDOMWidget[] {
  return (node.widgets ?? []).filter(
    (w) => w instanceof DOMWidgetImpl || w instanceof ComponentWidgetImpl
  )
}

export function registerDomWidgets(graph: LGraph): void {
  const store = useDomWidgetStore()
  forEachNode(graph, (node) => {
    for (const widget of domWidgetsOf(node)) store.registerWidget(widget)
  })
}

export function unregisterDomWidgets(graph: LGraph): void {
  const store = useDomWidgetStore()
  forEachNode(graph, (node) => {
    for (const widget of domWidgetsOf(node)) store.unregisterWidget(widget.id)
  })
}
