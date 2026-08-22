import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'opening the color picker from the node toolbox',
  { tag: ['@canvas'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('opening the color picker from the node toolbox works as recorded', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()
      await comfyPage.page.locator('#graph-canvas').click({
        position: {
          x: 546,
          y: 185
        }
      })
      await comfyPage.page.getByTestId('color-picker-button').click()
      await expect(
        comfyPage.page.locator('.p-selectbutton > button:nth-child(5)')
      ).toBeVisible()
    })
  }
)
