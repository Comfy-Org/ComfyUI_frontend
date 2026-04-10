import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('App mode welcome states', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
  })

  test('Empty workflow text is visible when no nodes', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await expect(comfyPage.appMode.emptyWorkflowText).toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).not.toBeVisible()
  })

  test('Build app button is visible when no outputs selected', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).toBeVisible()
    await expect(comfyPage.appMode.emptyWorkflowText).not.toBeVisible()
  })

  test('Empty workflow and build app are hidden when app has outputs', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])

    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    await expect(comfyPage.appMode.emptyWorkflowText).not.toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).not.toBeVisible()
  })

  test('Back to workflow returns to graph mode', async ({ comfyPage }) => {
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await comfyPage.appMode.backToWorkflowButton.click()

    await expect(comfyPage.canvas).toBeVisible()
    await expect(comfyPage.appMode.welcome).not.toBeVisible()
  })

  test('Load template opens template selector', async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await comfyPage.appMode.loadTemplateButton.click()

    await expect(comfyPage.templates.content).toBeVisible()
  })
})
