import type { LGraph, LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import { ComponentWidgetImpl, DOMWidgetImpl } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import type { BaseDOMWidget } from '@/types/domWidget'
import { forEachNode } from '@/utils/graphTraversalUtil'

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
