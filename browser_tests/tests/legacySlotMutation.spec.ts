import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test(
  'Legacy custom nodes can remove links through slot mirrors',
  { tag: ['@canvas', '@node'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')

    await test.step('Disconnect an input by assigning null', async () => {
      const disconnected = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const sampler = graph.nodes.find((node) => node.type === 'KSampler')
        if (!sampler) throw new Error('KSampler not found')

        const link = sampler.inputs[0].link
        sampler.inputs[0].link = null
        return link != null && !graph.links.has(link)
      })

      expect(disconnected).toBe(true)
    })

    await test.step('Disconnect one output link with splice', async () => {
      const topology = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const checkpoint = graph.nodes.find(
          (node) => node.type === 'CheckpointLoaderSimple'
        )
        if (!checkpoint) throw new Error('CheckpointLoaderSimple not found')

        const links = checkpoint.outputs[1].links!
        const removedLink = links[0]
        const retainedLink = links[1]
        links.splice(0, 1)

        return {
          removed: removedLink != null && !graph.links.has(removedLink),
          retained: retainedLink != null && graph.links.has(retainedLink),
          viewSynchronized: links.length === 1 && links[0] === retainedLink
        }
      })

      expect(topology).toEqual({
        removed: true,
        retained: true,
        viewSynchronized: true
      })
    })

    await test.step('Disconnect all output links by assigning an empty array', async () => {
      const disconnected = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const checkpoint = graph.nodes.find(
          (node) => node.type === 'CheckpointLoaderSimple'
        )
        if (!checkpoint) throw new Error('CheckpointLoaderSimple not found')

        const link = checkpoint.outputs[2].links![0]
        checkpoint.outputs[2].links = []
        return link != null && !graph.links.has(link)
      })

      expect(disconnected).toBe(true)
    })
  }
)
