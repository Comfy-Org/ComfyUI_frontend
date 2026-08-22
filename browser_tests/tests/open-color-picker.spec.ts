import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('open color picker', { tag: [] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('open color picker works as recorded', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()
    await comfyPage.page.locator('#graph-canvas').dblclick({
      position: {
        x: 544,
        y: 183
      }
    })
    await comfyPage.page.getByTestId('color-picker-button').click()
    await expect(
      comfyPage.page.locator('.p-selectbutton > button:nth-child(7)')
    ).toBeVisible()
  })
})
