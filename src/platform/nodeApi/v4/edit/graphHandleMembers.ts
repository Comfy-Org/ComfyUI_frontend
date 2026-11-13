import type { LGraph } from '@/lib/litegraph/src/LGraph'

import type { GraphScopeFor } from '@/platform/nodeApi/v4/graphScopeHandle'
import type { GraphHandleEdits } from '@/platform/nodeApi/v4/types'
import type { EditCore } from './edits'
import { checkedNodeCreation } from './graphEdits'
import type { GroupsOf } from './groupHandles'
import { linksIn } from './linkInfo'

/** The graph handle's edit methods, each a call to `comfy.edit`, and its reads of links and groups. */
export function graphHandleMembers(
  visible: () => LGraph | undefined,
  graphScopeFor: GraphScopeFor,
  edits: EditCore,
  groupsOf: GroupsOf
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
    },
    groups() {
      const graph = visible()
      return graph && groupsOf(graph)
    }
  }
}
