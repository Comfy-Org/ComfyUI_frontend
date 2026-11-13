import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { LiveNode, NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { EditRunner } from './editRunner'
import { checkedNodePatch } from './nodePatch'
import { createResizableChoices } from './nodeSizing'

/** The node edits, taking anything a pack passes and checking it. */
export interface NodeEdits {
  updateNode(node: unknown, patch: unknown): boolean
  removeNode(node: unknown): boolean
}

export function createNodeEdits(
  nodes: NodeHandles,
  runner: EditRunner
): NodeEdits {
  const resizable = createResizableChoices()

  return {
    updateNode(node, patch) {
      const live = liveNodeOf(nodes, 'updateNode', node)
      const writes = checkedNodePatch(patch, resizable)
      if (!live) return false
      runner.apply(live.graph, () => {
        for (const write of writes) write(live.node)
      })
      return true
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
