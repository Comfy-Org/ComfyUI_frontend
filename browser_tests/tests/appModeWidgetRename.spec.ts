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
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        linear_toggle_enabled: true
      }
    })
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  })

  test('Rename from builder input-select sidebar', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // Go back to inputs step where IoItems are shown
    await appMode.goToInputs()

    const menu = appMode.getBuilderInputItemMenu('seed')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await appMode.renameWidget(menu, 'Builder Input Seed')

    // Verify in app mode after save/reload
    await appMode.exitBuilder()
    const workflowName = `${new Date().getTime()} builder-input`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(
      appMode.linearWidgets.getByText('Builder Input Seed')
    ).toBeVisible()
  })

  test('Rename from builder preview step', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // In the new zone layout, rename is done from the inputs step
    await appMode.goToInputs()

    const menu = appMode.getBuilderInputItemMenu('seed')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await appMode.renameWidget(menu, 'Preview Seed')

    // Verify in app mode after save/reload
    await appMode.exitBuilder()
    const workflowName = `${new Date().getTime()} builder-preview`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('Preview Seed')).toBeVisible()
  })

  test('Rename persists across app mode toggle', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // Rename via builder inputs step (app mode no longer has inline rename)
    await appMode.goToInputs()
    const menu = appMode.getBuilderInputItemMenu('seed')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await appMode.renameWidget(menu, 'App Mode Seed')

    // Exit builder and enter app mode
    await appMode.exitBuilder()
    await appMode.toggleAppMode()

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('App Mode Seed')).toBeVisible()

    // Verify persistence after save/reload
    await appMode.toggleAppMode()
    const workflowName = `${new Date().getTime()} app-mode`
    await saveAndReopenInAppMode(comfyPage, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.linearWidgets.getByText('App Mode Seed')).toBeVisible()
  })
})
