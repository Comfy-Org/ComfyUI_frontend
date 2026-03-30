import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('App mode welcome states', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
  })

  test('Empty workflow text is visible when no nodes', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible({ timeout: 5000 })
    await expect(comfyPage.appMode.emptyWorkflowText).toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).not.toBeVisible()
  })

  test('Build app button is visible when no outputs selected', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible({ timeout: 5000 })
    await expect(comfyPage.appMode.buildAppButton).toBeVisible()
    await expect(comfyPage.appMode.emptyWorkflowText).not.toBeVisible()
  })

  test('Neither are visible when app is built', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])

    await expect(comfyPage.appMode.linearWidgets).toBeVisible({
      timeout: 5000
    })
    await expect(comfyPage.appMode.emptyWorkflowText).not.toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).not.toBeVisible()
  })
})
