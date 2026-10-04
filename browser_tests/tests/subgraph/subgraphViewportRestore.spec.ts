import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Subgraph viewport restoration', { tag: '@subgraph' }, () => {
  test('keeps the cached parent camera when a hidden subgraph fit is queued', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

    const expected = await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      const root = canvas.graph!
      const host = root.nodes.find((node) => String(node.id) === '2')
      if (!host?.isSubgraphNode()) throw new Error('Expected subgraph host 2')

      canvas.ds.scale = 1.375
      canvas.ds.offset[0] = 123
      canvas.ds.offset[1] = 234
      canvas.canvas.style.display = 'none'

      canvas.setGraph(host.subgraph)
      canvas.setGraph(root)
      canvas.canvas.style.display = ''

      return { scale: 1.375, offset: [123, 234] }
    })

    await comfyPage.nextFrame()
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => ({
          scale: window.app!.canvas.ds.scale,
          offset: [...window.app!.canvas.ds.offset]
        }))
      )
      .toEqual(expected)
  })
})
