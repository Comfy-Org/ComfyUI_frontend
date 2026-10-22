import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { isGraphLoading } from '@/core/graph/graphLoadState'

import { useTelemetry } from '@/platform/telemetry'
import { getCurrentNodeAddSource } from './nodeAddSource'

/**
 * Wire `app:node_added_to_workflow` telemetry into a graph. Bulk additions
 * during workflow load are skipped — `workflow_imported` already covers those.
 */
export function installNodeAddedTelemetry(graph: LGraph): void {
  graph.events.addEventListener('node:added', ({ detail: { node } }) => {
    if (isGraphLoading(graph)) return
    useTelemetry()?.trackNodeAdded({
      node_type: node.type,
      source: getCurrentNodeAddSource()
    })
  })
}
