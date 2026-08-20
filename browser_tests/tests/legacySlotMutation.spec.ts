import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test(
  'Legacy custom nodes can remove links through slot mirrors',
  { tag: ['@canvas', '@node'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')

    const topology = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      const checkpoint = graph.nodes.find(
        (node) => node.type === 'CheckpointLoaderSimple'
      )
      const sampler = graph.nodes.find((node) => node.type === 'KSampler')
      if (!checkpoint || !sampler) throw new Error('Required nodes not found')

      const modelLink = sampler.inputs[0].link
      const clipLinks = checkpoint.outputs[1].links!
      const removedClipLink = clipLinks[0]
      const retainedClipLink = clipLinks[1]
      const vaeLink = checkpoint.outputs[2].links![0]

      sampler.inputs[0].link = null
      clipLinks.splice(0, 1)
      checkpoint.outputs[2].links = []

      return {
        modelDisconnected: modelLink != null && !graph.links.has(modelLink),
        clipDisconnected:
          removedClipLink != null && !graph.links.has(removedClipLink),
        clipRetained:
          retainedClipLink != null && graph.links.has(retainedClipLink),
        retainedViewSynchronized:
          clipLinks.length === 1 && clipLinks[0] === retainedClipLink,
        vaeDisconnected: vaeLink != null && !graph.links.has(vaeLink)
      }
    })

    expect(topology).toEqual({
      modelDisconnected: true,
      clipDisconnected: true,
      clipRetained: true,
      retainedViewSynchronized: true,
      vaeDisconnected: true
    })
  }
)
