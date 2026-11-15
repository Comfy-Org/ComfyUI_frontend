import type { LGraph, LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { IBaseWidget, WidgetSizing } from '@comfyorg/graph-model/widgets'
import { reportError } from '@comfyorg/telemetry/reportError'

import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'

import type { RowSpec } from './nodeBodyLayout'

const reportedSizingFailures = new WeakMap<LGraph, Set<string>>()

function isFirstSizingFailure(widget: IBaseWidget, node: LGraphNode) {
  const graph = node.graph?.rootGraph
  if (!graph) return true
  const reported = reportedSizingFailures.get(graph) ?? new Set<string>()
  reportedSizingFailures.set(graph, reported)
  const key = `${node.type}:${widget.type}`
  if (reported.has(key)) return false
  reported.add(key)
  return true
}

function measureWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  width: number
): WidgetSizing | undefined {
  if (widget.computeSize) {
    return { kind: 'fixed', height: widget.computeSize(width)[1] }
  }
  const size = widget.computeLayoutSize?.(node)
  return size ? { kind: 'growable', ...size } : undefined
}

/** Measures a widget through its extension callbacks; a throwing callback yields no sizing and is reported once per widget type. */
export function getWidgetSizing(
  widget: IBaseWidget,
  node: LGraphNode,
  width = node.size[0]
): WidgetSizing | undefined {
  const source = resolvePromotedWidgetSource(undefined, node, widget)
  const owner = source?.sourceNode ?? node
  const concrete = source?.sourceWidget ?? widget
  try {
    return measureWidget(concrete, owner, width)
  } catch (cause) {
    if (isFirstSizingFailure(concrete, owner)) {
      reportError(cause, {
        errorType: 'error_measuring_widget',
        surface: 'graph',
        tags: { outcome: 'degraded' },
        context: { nodeType: owner.type, widgetType: concrete.type },
        fingerprint: ['error_measuring_widget', concrete.type]
      })
    }
    return undefined
  }
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
