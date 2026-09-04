import { readSubgraphDefinitions as readDefinitionSnapshots } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'

function isExportedSubgraph(value: unknown): value is ExportedSubgraph {
  if (typeof value !== 'object' || value === null) return false
  const graph = value as Record<string, unknown>
  const state = graph.state
  if (typeof state !== 'object' || state === null) return false
  const counters = state as Record<string, unknown>
  return (
    typeof graph.id === 'string' &&
    typeof graph.name === 'string' &&
    (graph.version === 0 || graph.version === 1) &&
    typeof graph.revision === 'number' &&
    typeof graph.inputNode === 'object' &&
    graph.inputNode !== null &&
    typeof graph.outputNode === 'object' &&
    graph.outputNode !== null &&
    typeof counters.lastNodeId === 'number' &&
    typeof counters.lastLinkId === 'number' &&
    typeof counters.lastGroupId === 'number' &&
    typeof counters.lastRerouteId === 'number' &&
    (graph.nodes === undefined || Array.isArray(graph.nodes)) &&
    (graph.links === undefined || Array.isArray(graph.links))
  )
}

/**
 * Read package-owned definition snapshots and keep the shapes LiteGraph can
 * configure. The package owns the Yjs layout and projection rules; this local
 * gate only narrows its untrusted JSON boundary to LiteGraph's runtime shape.
 */
export function readSubgraphDefinitions(doc: Y.Doc): ExportedSubgraph[] {
  const definitions: ExportedSubgraph[] = []
  for (const snapshot of readDefinitionSnapshots(doc)) {
    if (isExportedSubgraph(snapshot)) definitions.push(snapshot)
  }
  return definitions
}
