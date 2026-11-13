import type { LGraph } from '@/lib/litegraph/src/LGraph'

import type { GraphScopeFor } from '@/platform/nodeApi/v4/graphScopeHandle'
import type { GraphHandleEdits } from '@/platform/nodeApi/v4/types'
import type { EditCore } from './edits'
import { checkedNodeCreation } from './graphEdits'
import { linksIn } from './linkInfo'

/** The graph handle's edit methods, each a call to `comfy.edit`, and its link read. */
export function graphHandleMembers(
  visible: () => LGraph | undefined,
  graphScopeFor: GraphScopeFor,
  edits: EditCore
): GraphHandleEdits {
  return {
    add(type, init) {
      const graph = visible()
      if (graph) return edits.addNode(graphScopeFor(graph), type, init)
      checkedNodeCreation(type, init)
      return undefined
    },
    batch: (fn) => edits.batch(fn),
    links() {
      const graph = visible()
      return graph && linksIn(graph)
    }
  }
}
