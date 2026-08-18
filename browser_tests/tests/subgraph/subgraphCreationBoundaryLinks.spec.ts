import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test(
  'Subgraph creation rewires boundary links to compatible slots across reload',
  { tag: ['@slow', '@subgraph', '@vue-nodes'] },
  async ({ comfyPage }) => {
    const expectedSnapshot = {
      rootLinks: [
        '4:0->HOST:0',
        '4:1->6:0',
        '4:1->7:0',
        '4:2->HOST:4',
        '5:0->HOST:3',
        '6:0->HOST:1',
        '7:0->HOST:2',
        'HOST:0->9:0'
      ],
      incompatibleHostInputLinks: []
    }

    await test.step('Select both nodes in the default workflow', async () => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.workflow.loadWorkflow('default')

      // VAE Decode sits past the right edge of the 1280px canvas at the default
      // view, so clicking its title silently misses and the selection is left
      // holding KSampler alone.
      await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
      const vaeDecode = await comfyPage.nodeOps.getNodeRefById('8')
      const canvasWidth = (await comfyPage.canvas.boundingBox())!.width
      let previousX = Number.NaN
      await expect
        .poll(async () => {
          const { x } = await vaeDecode.getTitlePosition()
          const settledInView = x === previousX && x < canvasWidth
          previousX = x
          return settledInView
        })
        .toBe(true)

      await comfyPage.nodeOps.selectNodes(['KSampler', 'VAE Decode'])
      expect(
        await comfyPage.nodeOps.getSelectedNodeIds(),
        'both nodes must be selected, or the conversion under test is not the one being asserted'
      ).toEqual(['3', '8'])
    })

    await test.step('Convert and verify the boundary links', async () => {
      const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
      await ksampler.convertToSubgraph()

      await expect
        .poll(() => comfyPage.subgraph.getBoundaryLinkSnapshot())
        .toEqual(expectedSnapshot)
    })

    await test.step('Reload and verify the boundary links', async () => {
      await comfyPage.subgraph.serializeAndReload()

      await expect
        .poll(() => comfyPage.subgraph.getBoundaryLinkSnapshot())
        .toEqual(expectedSnapshot)
    })
  }
)
