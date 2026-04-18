import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('App mode welcome states', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.appMode.suppressVueNodeSwitchPopup()
  })

  test('Empty workflow text is visible when no nodes', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await expect(comfyPage.appMode.emptyWorkflowText).toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).toBeHidden()
  })

  test('Build app button is visible when no outputs selected', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).toBeVisible()
    await expect(comfyPage.appMode.emptyWorkflowText).toBeHidden()
  })

  test('Empty workflow and build app are hidden when app has outputs', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])

    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    await expect(comfyPage.appMode.emptyWorkflowText).toBeHidden()
    await expect(comfyPage.appMode.buildAppButton).toBeHidden()
  })

  test('Back to workflow returns to graph mode', async ({ comfyPage }) => {
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await comfyPage.appMode.backToWorkflowButton.click()

    await expect(comfyPage.canvas).toBeVisible()
    await expect(comfyPage.appMode.welcome).toBeHidden()
  })

  test('Load template opens template selector', async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await comfyPage.appMode.loadTemplateButton.click()

    await expect(comfyPage.templates.content).toBeVisible()
  })

  test('Empty workflow dialog blocks entering builder on an empty graph', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await comfyPage.nodeOps.clearGraph()
    await appMode.enterBuilder()

    await expect(appMode.emptyWorkflowDialog).toBeVisible()
    await expect(appMode.emptyWorkflowBackButton).toBeVisible()
    await expect(appMode.emptyWorkflowLoadTemplateButton).toBeVisible()

    // Back to workflow dismisses the dialog and returns to graph mode
    await appMode.emptyWorkflowBackButton.click()
    await expect(appMode.emptyWorkflowDialog).toBeHidden()
    await expect(comfyPage.canvas).toBeVisible()
  })

  test('Empty workflow dialog "Load template" opens the template selector', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await comfyPage.nodeOps.clearGraph()
    await appMode.enterBuilder()

    await expect(appMode.emptyWorkflowDialog).toBeVisible()
    await appMode.emptyWorkflowLoadTemplateButton.click()

    await expect(appMode.emptyWorkflowDialog).toBeHidden()
    await expect(comfyPage.templates.content).toBeVisible()
  })
})
