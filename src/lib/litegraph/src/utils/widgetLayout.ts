import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { IBaseWidget, WidgetSizing } from '@comfyorg/graph-model/widgets'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { reportError } from '@comfyorg/telemetry/reportError'

import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import { widgetRenderer } from '@/lib/litegraph/src/utils/widget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

const reportedSizingFailures = new Set<string>()

function isFirstSizingFailure(widget: IBaseWidget) {
  if (reportedSizingFailures.has(widget.type)) return false
  reportedSizingFailures.add(widget.type)
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
    if (isFirstSizingFailure(concrete)) {
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

/** The least height a widget row with `sizing` takes. */
export function minRowHeight(sizing: WidgetSizing): number {
  return sizing.kind === 'fixed' ? sizing.height : sizing.minHeight
}

/** Each widget's row sizing for canvas layout, with `rowGap` added below fixed rows and `defaultHeight` for widgets that declare none. */
export function widgetRowSizings(
  sizings: readonly (WidgetSizing | undefined)[],
  defaultHeight: number,
  rowGap: number
): WidgetSizing[] {
  return sizings.map((measured) => {
    const sizing = measured ?? { kind: 'fixed', height: defaultHeight }
    return sizing.kind === 'fixed'
      ? { ...sizing, height: sizing.height + rowGap }
      : sizing
  })
}

/** Stores a widget's sizing and renderer in its render component. */
export function publishWidgetRenderFacts(
  node: LGraphNode,
  widget: IBaseWidget,
  sizing: WidgetSizing | undefined
): void {
  const graphId = node.graph?.rootGraph.id
  if (!graphId) return
  useWidgetValueStore().setWidgetRenderFacts(
    widgetId(graphId, node.id, widget.name),
    { sizing, renderer: widgetRenderer(widget) }
  )
}
