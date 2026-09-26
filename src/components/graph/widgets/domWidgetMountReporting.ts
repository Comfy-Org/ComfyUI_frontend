import { reportError } from '@/platform/telemetry/reportError'
import type { NodeId } from '@/types/nodeId'

const MAX_REPORTS_PER_SESSION = 20

const reportedMessages = new Set<string>()

type DomWidgetMountContext = {
  nodeId: NodeId
  nodeType: string | undefined
  widgetName: string
}

/**
 * Whatever breaks `appendChild` for one DOM widget usually breaks it for every
 * DOM widget in the graph, and widgets remount on each visibility flip, so
 * reports are deduplicated by message and capped per session.
 */
export function reportDomWidgetMountFailure(
  error: unknown,
  context: DomWidgetMountContext
): void {
  const message = error instanceof Error ? error.message : String(error)
  if (reportedMessages.has(message)) return
  if (reportedMessages.size >= MAX_REPORTS_PER_SESSION) return
  reportedMessages.add(message)

  reportError(error, {
    errorType: 'canvas_dom_widget_mount_failed',
    context,
    level: 'error'
  })
}
