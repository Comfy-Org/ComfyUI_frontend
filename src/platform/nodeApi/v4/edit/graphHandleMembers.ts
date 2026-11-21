import type { LGraph } from '@/lib/litegraph/src/LGraph'

import type { GraphScopeFor } from '@/platform/nodeApi/v4/graphScopeHandle'
import type { GraphHandle } from '@/platform/nodeApi/v4/types'
import type { EditCore } from './edits'
import { checkedNodeCreation } from './graphEdits'
import type { GroupsOf } from './groupHandles'
import { linksIn } from './linkInfo'

const NONE: readonly never[] = Object.freeze([])

/** The graph handle's edit methods, through the edit core, and its reads of links and groups. */
export function graphHandleMembers(
  visible: () => LGraph | undefined,
  graphScopeFor: GraphScopeFor,
  edits: EditCore,
  groupsOf: GroupsOf
): Pick<GraphHandle, 'add' | 'batch' | 'links' | 'groups'> {
  return {
    add(type, init) {
      const graph = visible()
      if (graph) return edits.addNode(graphScopeFor(graph), type, init, 'add')
      checkedNodeCreation('add', type, init)
      return undefined
    },
    batch: (fn) => edits.batch(fn),
    links() {
      const graph = visible()
      return graph ? linksIn(graph) : NONE
    },
    groups() {
      const graph = visible()
      return graph ? groupsOf(graph) : NONE
    }
  }
}
