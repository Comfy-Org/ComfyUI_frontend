import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { IBaseWidget, WidgetSizing } from '@comfyorg/graph-model/widgets'
import { reportError } from '@comfyorg/telemetry/reportError'

import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'

import type { RowSpec } from './nodeBodyLayout'

type WidgetSizingFailure = { kind: 'failed'; cause: unknown }

const reportedSizingFailures = new WeakSet<IBaseWidget>()

function widgetSizingFailure(
  widget: IBaseWidget,
  node: LGraphNode,
  cause: unknown
): WidgetSizingFailure {
  if (!reportedSizingFailures.has(widget)) {
    reportedSizingFailures.add(widget)
    reportError(cause, {
      errorType: 'error_measuring_widget',
      surface: 'graph',
      tags: { outcome: 'degraded' },
      context: { nodeType: node.type, widgetType: widget.type }
    })
  }
  return { kind: 'failed', cause }
}

export function getWidgetSizing(
  widget: IBaseWidget,
  node: LGraphNode,
  width = node.size[0]
): WidgetSizing | WidgetSizingFailure | undefined {
  const source = resolvePromotedWidgetSource(undefined, node, widget)
  const owner = source?.sourceNode ?? node
  const concrete = source?.sourceWidget ?? widget
  if (concrete.computeSize) {
    try {
      return { kind: 'fixed', height: concrete.computeSize(width)[1] }
    } catch (cause) {
      return widgetSizingFailure(concrete, owner, cause)
    }
  }
  try {
    const size = concrete.computeLayoutSize?.(owner)
    return size ? { kind: 'growable', ...size } : undefined
  } catch (cause) {
    return widgetSizingFailure(concrete, owner, cause)
  }
}

export function widgetRowSpecs(
  widgets: readonly IBaseWidget[],
  node: LGraphNode,
  defaultHeight: number,
  rowGap: number
): RowSpec[] {
  return widgets.map((widget) => {
    const result = getWidgetSizing(widget, node)
    const sizing: WidgetSizing =
      !result || result.kind === 'failed'
        ? { kind: 'fixed', height: defaultHeight }
        : result
    return {
      name: widget.name,
      sizing:
        sizing.kind === 'fixed'
          ? { ...sizing, height: sizing.height + rowGap }
          : sizing
    }
  })
}
