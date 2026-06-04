import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { ChangeTracker } from '@/scripts/changeTracker'

import { useTelemetry } from '..'
import { getCurrentNodeAddSource } from './nodeAddSource'

/**
 * Wire `app:node_added_to_workflow` telemetry into a graph. Wraps any existing
 * `onNodeAdded` callback so we don't displace other subscribers. Bulk
 * additions during workflow load are skipped — `workflow_imported`
 * already covers those.
 */
export function installNodeAddedTelemetry(graph: LGraph): void {
  const previous = graph.onNodeAdded
  graph.onNodeAdded = function (node) {
    previous?.call(this, node)
    if (ChangeTracker.isLoadingGraph) return
    useTelemetry()?.trackNodeAdded({
      node_type: node.type ?? 'unknown',
      source: getCurrentNodeAddSource()
    })
  }
}
