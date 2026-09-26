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
      // Resolved by name, not by index. `destination` and `source` are both
      // IMAGE inputs and landing on the wrong one is the defect this test
      // exists to catch, so a positional lookup would be using the thing under
      // test to decide what the test is looking at.
      const destinationInput = await target.getInputByName('destination')
      expect(
        await destinationInput.getLink(),
        'destination should start unconnected'
      ).toBeNull()

      await source.connectOutput(0, target, destinationInput.index)

      await expect
        .poll(() => destinationInput.getLink())
        .toMatchObject({
          origin_id: source.id
        })
    })
  }
)
