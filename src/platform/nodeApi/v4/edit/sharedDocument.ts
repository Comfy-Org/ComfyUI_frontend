import { isRootGraphDocBound } from '@/lib/litegraph/src/docBoundGraphs'
import type { LGraph } from '@/lib/litegraph/src/LGraph'

export function isShared(graph: LGraph): boolean {
  return isRootGraphDocBound(graph.rootGraph.id)
}
