import { isRootGraphDocBound } from '@/lib/litegraph/src/docBoundGraphs'
import type { LGraph } from '@/lib/litegraph/src/LGraph'

/**
 * True while `graph`'s document is bound to a shared document, which an edit
 * that raises no graph intent (a slot edit, a re-pointed link) never reaches (#23382).
 */
export function isShared(graph: LGraph): boolean {
  return isRootGraphDocBound(graph.rootGraph.id)
}
