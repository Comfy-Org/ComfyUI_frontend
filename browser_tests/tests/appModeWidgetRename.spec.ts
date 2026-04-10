import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  saveAndReopenInAppMode,
  setupSubgraphBuilder
} from '@e2e/helpers/builderTestUtils'

test.describe('App mode widget rename', { tag: ['@ui', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  })

  test('Rename from builder input-select sidebar via menu', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // Go back to inputs step where IoItems are shown
    await appMode.steps.goToInputs()

    const menu = appMode.select.getInputItemMenu('seed')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await appMode.select.renameInputViaMenu('seed', 'Builder Input Seed')

    // Verify in app mode after save/reload
    await appMode.footer.exitBuilder()
    const workflowName = `${new Date().getTime()} builder-input-menu`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(
      appMode.linearWidgets.getByText('Builder Input Seed')
    ).toBeVisible()
  })

  test('Rename from builder input-select sidebar via double-click', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    await appMode.steps.goToInputs()

    await appMode.select.renameInput('seed', 'Dblclick Seed')

    await appMode.footer.exitBuilder()
    const workflowName = `${new Date().getTime()} builder-input-dblclick`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('Dblclick Seed')).toBeVisible()
  })

  test('Rename from builder preview sidebar', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    await appMode.steps.goToPreview()

    const menu = appMode.select.getPreviewWidgetMenu('seed — New Subgraph')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await appMode.select.renameWidget(menu, 'Preview Seed')

    // Verify in app mode after save/reload
    await appMode.footer.exitBuilder()
    const workflowName = `${new Date().getTime()} builder-preview`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('Preview Seed')).toBeVisible()
  })

  test('Rename from app mode', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // Enter app mode from builder
    await appMode.footer.exitBuilder()
    await appMode.toggleAppMode()

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })

    const menu = appMode.getAppModeWidgetMenu('seed')
    await appMode.select.renameWidget(menu, 'App Mode Seed')

    await expect(appMode.linearWidgets.getByText('App Mode Seed')).toBeVisible()

    // Verify persistence after save/reload
    await appMode.toggleAppMode()
    const workflowName = `${new Date().getTime()} app-mode`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('App Mode Seed')).toBeVisible()
  })
})
