import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('App mode welcome states', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.appMode.suppressVueNodeSwitchPopup()
  })

  test('Get started page is visible when no nodes', async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.getStarted).toBeVisible()
    await expect(comfyPage.appMode.welcome).toBeHidden()
    await expect(comfyPage.appMode.buildAppButton).toBeHidden()
  })

  test('Build app button is visible when no outputs selected', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.welcome).toBeVisible()
    await expect(comfyPage.appMode.buildAppButton).toBeVisible()
    await expect(comfyPage.appMode.getStarted).toBeHidden()
  })

  test('Get started and build app are hidden when app has outputs', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])

    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    await expect(comfyPage.appMode.getStarted).toBeHidden()
    await expect(comfyPage.appMode.buildAppButton).toBeHidden()
  })

  test('Clicking a featured template loads it into the graph', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await comfyPage.appMode.getStartedTemplateCards.first().click()

    await expect(comfyPage.appMode.getStarted).toBeHidden()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBeGreaterThan(0)
  })

  test('Discover all templates opens template selector', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.appMode.getStarted).toBeVisible()
    await comfyPage.appMode.getStartedDiscoverButton.click()

    await expect(comfyPage.templates.content).toBeVisible()
  })

  test('Remote order flag reorders the featured templates', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.appMode.getStarted).toBeVisible()

    const naturalOrder = await comfyPage.appMode.getStartedTemplateNames()
    expect(naturalOrder.length).toBeGreaterThan(1)

    const reversed = [...naturalOrder].reverse()
    await comfyPage.featureFlags.setFlags({
      'app-mode-template-order': { templateIds: reversed }
    })

    // Snapshot mode reads the payload on mount, so remount the page by leaving
    // and re-entering app mode.
    await comfyPage.appMode.toggleAppMode()
    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.appMode.getStarted).toBeVisible()

    await expect
      .poll(() => comfyPage.appMode.getStartedTemplateNames())
      .toEqual(reversed)
  })

  test('Invalid remote order payload falls back to the default order', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.appMode.getStarted).toBeVisible()

    const naturalOrder = await comfyPage.appMode.getStartedTemplateNames()
    expect(naturalOrder.length).toBeGreaterThan(0)

    await comfyPage.featureFlags.setFlags({
      'app-mode-template-order': { templateIds: 'not-an-array' }
    })

    await comfyPage.appMode.toggleAppMode()
    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.appMode.getStarted).toBeVisible()

    await expect
      .poll(() => comfyPage.appMode.getStartedTemplateNames())
      .toEqual(naturalOrder)
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
