import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import {
  saveAndReopenInAppMode,
  setupSubgraphBuilder
} from '../helpers/builderTestUtils'

test.describe('App mode widget rename', { tag: ['@ui', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window.__setServerCapability!('linear_toggle_enabled', true)
    })
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
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
    await appMode.goToInputs()

    const menu = appMode.getBuilderInputItemMenu('seed')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await appMode.renameBuilderInputViaMenu('seed', 'Builder Input Seed')

    // Verify in app mode after save/reload
    await appMode.exitBuilder()
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

    await appMode.goToInputs()

    await appMode.renameBuilderInput('seed', 'Dblclick Seed')

    await appMode.exitBuilder()
    const workflowName = `${new Date().getTime()} builder-input-dblclick`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('Dblclick Seed')).toBeVisible()
  })

  test('Rename from builder preview sidebar', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    await appMode.goToPreview()

    const menu = appMode.getBuilderPreviewWidgetMenu('seed — New Subgraph')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await appMode.renameWidget(menu, 'Preview Seed')

    // Verify in app mode after save/reload
    await appMode.exitBuilder()
    const workflowName = `${new Date().getTime()} builder-preview`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('Preview Seed')).toBeVisible()
  })

  test('Rename from app mode', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // Enter app mode from builder
    await appMode.exitBuilder()
    await appMode.toggleAppMode()

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })

    const menu = appMode.getAppModeWidgetMenu('seed')
    await appMode.renameWidget(menu, 'App Mode Seed')

    await expect(appMode.linearWidgets.getByText('App Mode Seed')).toBeVisible()

    // Verify persistence after save/reload
    await appMode.toggleAppMode()
    const workflowName = `${new Date().getTime()} app-mode`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('App Mode Seed')).toBeVisible()
  })
})
