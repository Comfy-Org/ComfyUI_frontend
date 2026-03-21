import type { ComfyPage } from '../fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { fitToViewInstant } from '../helpers/fitToView'
import { getPromotedWidgetNames } from '../helpers/promotedWidgets'

/**
 * Convert the KSampler (id 3) in the default workflow to a subgraph,
 * enter builder, select the promoted seed widget as input and
 * SaveImage/PreviewImage as output.
 *
 * Returns the subgraph node reference for further interaction.
 */
async function setupSubgraphBuilder(comfyPage: ComfyPage) {
  const { page, appMode } = comfyPage
  await comfyPage.workflow.loadWorkflow('default')

  const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
  await ksampler.click('title')
  const subgraphNode = await ksampler.convertToSubgraph()
  await comfyPage.nextFrame()

  const subgraphNodeId = String(subgraphNode.id)
  const promotedNames = await getPromotedWidgetNames(comfyPage, subgraphNodeId)
  expect(promotedNames).toContain('seed')

  await fitToViewInstant(comfyPage)
  await appMode.enterBuilder()
  await appMode.goToInputs()

  // Click the promoted seed widget on the canvas to select it
  const seedWidgetRef = await subgraphNode.getWidget(0)
  const seedPos = await seedWidgetRef.getPosition()
  await page.mouse.click(seedPos.x, seedPos.y)
  await comfyPage.nextFrame()

  // Select an output node
  await appMode.goToOutputs()

  const saveImageNodeId = await page.evaluate(() =>
    String(
      window.app!.rootGraph.nodes.find(
        (n: { type?: string }) =>
          n.type === 'SaveImage' || n.type === 'PreviewImage'
      )?.id
    )
  )
  const saveImageRef = await comfyPage.nodeOps.getNodeRefById(saveImageNodeId)
  const saveImagePos = await saveImageRef.getPosition()
  // Click left edge — the right side is hidden by the builder panel
  await page.mouse.click(saveImagePos.x + 10, saveImagePos.y - 10)
  await comfyPage.nextFrame()

  return subgraphNode
}

/** Save the workflow, reopen it, and enter app mode. */
async function saveAndReopenInAppMode(
  comfyPage: ComfyPage,
  workflowName: string
) {
  await comfyPage.menu.topbar.saveWorkflow(workflowName)

  const { workflowsTab } = comfyPage.menu
  await workflowsTab.open()
  await workflowsTab.getPersistedItem(workflowName).dblclick()
  await comfyPage.nextFrame()

  await comfyPage.appMode.toggleAppMode()
}

test.describe('App mode widget rename', { tag: ['@ui', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        linear_toggle_enabled: true
      }
    })
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
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
