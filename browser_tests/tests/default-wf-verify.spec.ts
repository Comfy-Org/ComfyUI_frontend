import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('default wf verify', { tag: ['@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('default wf verify works as recorded', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    await comfyPage.canvas.click({ position: { x: 400, y: 300 } })
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toBeVisible()
  })
})
