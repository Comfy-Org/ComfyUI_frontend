import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('color picker opens from toolbox', { tag: [] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('color picker opens from toolbox works as recorded', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()
    await comfyPage.page.locator('#graph-canvas').click({
      position: {
        x: 518,
        y: 183
      }
    })
    await comfyPage.page.getByTestId('color-picker-button').click()
    await expect(
      comfyPage.page.locator('.p-selectbutton > button:nth-child(5)')
    ).toBeVisible()
  })
})
