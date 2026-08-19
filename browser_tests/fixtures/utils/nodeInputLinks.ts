import { toNodeId } from '@/types/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

interface ConnectedInput {
  name: string
  originNodeId: string
}

/**
 * Connected input slots of a node whose name starts with `namePrefix`, in slot
 * order, paired with the node each link originates from.
 *
 * Reading the link graph directly is the only way to tell a rewired connection
 * from a dropped one: a slot that lost its link and a slot that never had one
 * render identically.
 */
export async function getConnectedInputs(
  comfyPage: ComfyPage,
  nodeId: string,
  namePrefix: string
): Promise<ConnectedInput[]> {
  return comfyPage.page.evaluate(
    ({ nodeId, namePrefix }) => {
      const graph = window.app!.canvas.graph!
      const node = graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)

      return node.inputs
        .filter((input) => input.name.startsWith(namePrefix))
        .flatMap((input) => {
          if (input.link == null) return []
          const link = graph.links[input.link]
          if (!link) return []
          return [{ name: input.name, originNodeId: String(link.origin_id) }]
        })
    },
    { nodeId: toNodeId(nodeId), namePrefix }
  )
}
