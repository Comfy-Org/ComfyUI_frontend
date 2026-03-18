import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

async function injectLinearData(page: Page) {
  await page.evaluate(async () => {
    const graph = window.app!.graph
    if (!graph) return

    const outputNodeIds = graph.nodes
      .filter(
        (n: { type?: string }) =>
          n.type === 'SaveImage' || n.type === 'PreviewImage'
      )
      .map((n: { id: number | string }) => String(n.id))

    const ksampler = graph.nodes.find(
      (n: { type?: string }) => n.type === 'KSampler'
    )
    const inputs: [string, string][] = ksampler
      ? [[String(ksampler.id), 'seed']]
      : []

    const workflow = graph.serialize() as unknown as Record<string, unknown>
    const extra = (workflow.extra ?? {}) as Record<string, unknown>
    extra.linearData = { inputs, outputs: outputNodeIds }
    workflow.extra = extra
    await window.app!.loadGraphData(
      workflow as unknown as Parameters<
        NonNullable<typeof window.app>['loadGraphData']
      >[0]
    )
  })
}

async function toggleLinearMode(page: Page) {
  await page.evaluate(() => {
    window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
  })
}

test.describe('App mode widget rename', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('Rename persists after saving and reloading workflow', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    // Enter app mode with KSampler seed widget as input
    await injectLinearData(page)
    await comfyPage.nextFrame()
    await toggleLinearMode(page)
    await comfyPage.nextFrame()

    const widgetsContainer = page.locator('[data-testid="linear-widgets"]')
    await expect(widgetsContainer).toBeVisible({ timeout: 5000 })

    // Click the ellipsis button on the seed widget
    const ellipsisButton = widgetsContainer
      .locator('button:has(i.icon-\\[lucide--ellipsis\\])')
      .first()
    await ellipsisButton.click()

    // Click "Rename" in the popover
    await page.getByText('Rename', { exact: true }).click()

    // Fill in the rename prompt dialog
    const dialogInput = page.locator('.p-dialog-content input[type="text"]')
    await dialogInput.fill('My Custom Seed')
    await page.keyboard.press('Enter')
    await dialogInput.waitFor({ state: 'hidden' })
    await comfyPage.nextFrame()

    // Verify the widget label is updated
    await expect(widgetsContainer.getByText('My Custom Seed')).toBeVisible()

    // Exit app mode to access topbar
    await toggleLinearMode(page)
    await comfyPage.nextFrame()

    // Save workflow
    const workflowName = `${new Date().getTime()} workflow`
    await comfyPage.menu.topbar.saveWorkflow(workflowName)

    // Open the saved workflow from the browse tree in a fresh tab
    const { workflowsTab } = comfyPage.menu
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(workflowName).dblclick()
    await comfyPage.nextFrame()

    // Re-enter app mode on the reloaded workflow
    await toggleLinearMode(page)
    await comfyPage.nextFrame()

    // Verify the renamed label persisted
    const reloadedWidgets = page.locator('[data-testid="linear-widgets"]')
    await expect(reloadedWidgets).toBeVisible({ timeout: 5000 })
    await expect(reloadedWidgets.getByText('My Custom Seed')).toBeVisible()
  })
})
