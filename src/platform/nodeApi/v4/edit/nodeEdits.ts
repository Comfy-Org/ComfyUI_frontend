import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { LiveNode, NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { EditRunner } from './editRunner'
import { checkedNodePatch } from './nodePatch'
import { assertWidgetSavingKept } from './refusedEdits'
import { isAwaitingSavedState } from './awaitingSavedState'

/** The node edits, taking anything a pack passes and checking it. */
export interface NodeEdits {
  /** `member` names the call a refusal blames, for a handle method that calls this. */
  updateNode(node: unknown, patch: unknown, member?: string): boolean
  removeNode(node: unknown): boolean
}

export function createNodeEdits(
  nodes: NodeHandles,
  runner: EditRunner
): NodeEdits {
  return {
    updateNode(node, patch, member = 'updateNode') {
      const live = liveNodeOf(nodes, member, node)
      const { writes, stopsSavingWidgets } = checkedNodePatch(patch, member)
      if (!live) return false
      if (stopsSavingWidgets) assertWidgetSavingKept(member, live.node)
      if (isAwaitingSavedState(live.node)) return false
      return runner.apply(live.graph, () =>
        writes.map((write) => write(live.node)).every((kept) => kept !== false)
      )
    },

    removeNode(node) {
      const live = liveNodeOf(nodes, 'removeNode', node)
      if (!live) return false
      const { graph } = live
      runner.apply(graph, () => graph.remove(live.node))
      return graph.getNodeById(live.node.id) !== live.node
    }
  }
}

/**
 * The node a pack's handle names, in its own graph and document, or
 * `undefined` once it is gone. Anything that is not a node handle throws.
 */
export function liveNodeOf(
  nodes: NodeHandles,
  member: string,
  handle: unknown
): LiveNode | undefined {
  const locate = nodes.locator(handle)
  if (!locate) throw invalidArgument(member, 'a node handle', handle)
  return locate()
}
