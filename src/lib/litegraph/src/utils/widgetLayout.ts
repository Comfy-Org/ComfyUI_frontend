import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { IBaseWidget, WidgetSizing } from '@comfyorg/graph-model/widgets'

import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'

import type { RowSpec } from './nodeBodyLayout'

export function getWidgetSizing(
  widget: IBaseWidget,
  node: LGraphNode,
  width = node.size[0]
): WidgetSizing | undefined {
  const source = resolvePromotedWidgetSource(undefined, node, widget)
  const owner = source?.sourceNode ?? node
  const concrete = source?.sourceWidget ?? widget
  if (concrete.computeSize) {
    return { kind: 'fixed', height: concrete.computeSize(width)[1] }
  }
  const size = concrete.computeLayoutSize?.(owner)
  return size ? { kind: 'growable', ...size } : undefined
}

export function widgetRowSpecs(
  widgets: readonly IBaseWidget[],
  node: LGraphNode,
  defaultHeight: number,
  rowGap: number
): RowSpec[] {
  return widgets.map((widget) => {
    const sizing: WidgetSizing = getWidgetSizing(widget, node) ?? {
      kind: 'fixed',
      height: defaultHeight
    }
    return {
      name: widget.name,
      sizing:
        sizing.kind === 'fixed'
          ? { ...sizing, height: sizing.height + rowGap }
          : sizing
    }
  })
}
