import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

export function refreshDownloadedTemplateInputBindings(
  rootGraph: LGraph,
  candidates: readonly MissingMediaCandidate[],
  completedInputNames: ReadonlySet<string>
): void {
  const refreshedWidgets = new Set<string>()

  for (const candidate of candidates) {
    if (!completedInputNames.has(candidate.name)) continue

    const widgetId = `${String(candidate.nodeId)}\0${candidate.widgetName}`
    if (refreshedWidgets.has(widgetId)) continue

    const node = getNodeByExecutionId(rootGraph, String(candidate.nodeId))
    const widget = node?.widgets?.find(
      ({ name }) => name === candidate.widgetName
    )
    if (!node || widget?.value !== candidate.name || !widget.callback) continue

    refreshedWidgets.add(widgetId)
    widget.callback(widget.value, undefined, node)
  }
}
