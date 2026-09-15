import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Link drop under device scaling',
  { tag: ['@canvas', '@2x', '@0.5x'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('links/device_scale_link_drop')
    })

    test('A dragged link lands on the slot it was aimed at', async ({
      comfyPage
    }) => {
      const source = await comfyPage.nodeOps.getNodeRefById(1)
      const target = await comfyPage.nodeOps.getNodeRefById(2)
      const destinationInput = await target.getInput(0)
      expect(
        await destinationInput.getLink(),
        'destination should start unconnected'
      ).toBeNull()

      await source.connectOutput(0, target, 0)

      await expect
        .poll(() => destinationInput.getLink())
        .toMatchObject({
          origin_id: source.id
        })
    })
  }
)
