import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export function nodeGraphPosition(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)
    return [node.pos[0], node.pos[1]]
  }, nodeId)
}
