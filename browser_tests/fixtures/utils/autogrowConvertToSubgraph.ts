import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { AUTOGROW_THEN_MASK_NODE_TYPE } from '@e2e/fixtures/data/autogrowThenMaskNodeDef'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const SOURCE_NODE_ID = '1'
export const AUTOGROW_NODE_ID = '2'

export const EXPECTED_CONNECTIONS = {
  'images.image0': 'IMAGE',
  'images.image1': 'IMAGE',
  'images.image2': 'IMAGE',
  mask: 'MASK'
}

export async function connectGrownGroupAndMask(
  comfyPage: ComfyPage
): Promise<void> {
  await comfyPage.page.evaluate(
    ({ sourceId, targetId }) => {
      const graph = window.app!.graph
      const source = graph.getNodeById(sourceId)
      const target = graph.getNodeById(targetId)
      if (!source || !target) throw new Error('Workflow nodes not found')
      const slotOf = (name: string) =>
        target.inputs.findIndex((input) => input.name === name)
      for (const name of ['images.image0', 'images.image1', 'images.image2'])
        source.connect(0, target, slotOf(name))
      source.connect(1, target, slotOf('mask'))
    },
    { sourceId: toNodeId(SOURCE_NODE_ID), targetId: toNodeId(AUTOGROW_NODE_ID) }
  )
  await comfyPage.nextFrame()
}

export async function rootConnections(
  comfyPage: ComfyPage
): Promise<Record<string, string>> {
  return comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    return Object.fromEntries(
      node.inputs.flatMap((input, slot) => {
        const link = node.getInputLink(slot)
        return link ? [[input.name, String(link.type)]] : []
      })
    )
  }, toNodeId(AUTOGROW_NODE_ID))
}

export async function innerConnections(
  comfyPage: ComfyPage,
  subgraphNodeId: string
): Promise<Record<string, string>> {
  return comfyPage.page.evaluate(
    ({ subgraphNodeId, nodeType }) => {
      const subgraphNode = window.app!.graph.getNodeById(subgraphNodeId)
      if (!subgraphNode?.isSubgraphNode())
        throw new Error(`Expected subgraph node ${subgraphNodeId}`)
      const inner = subgraphNode.subgraph.nodes.find(
        (node) => node.type === nodeType
      )
      if (!inner) throw new Error('Autogrow node not found in the subgraph')
      return Object.fromEntries(
        inner.inputs.flatMap((input, slot) => {
          const link = inner.getInputLink(slot)
          return link ? [[input.name, String(link.type)]] : []
        })
      )
    },
    {
      subgraphNodeId: toNodeId(subgraphNodeId),
      nodeType: AUTOGROW_THEN_MASK_NODE_TYPE
    }
  )
}
