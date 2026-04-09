import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Node library sidebar V2', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', true)

    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
  })

  test('Can switch between tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')

    await tab.blueprintsTab.click()
    await expect(tab.blueprintsTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.allTab).toHaveAttribute('aria-selected', 'false')

    await tab.allTab.click()
    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.blueprintsTab).toHaveAttribute('aria-selected', 'false')
  })

  test('All tab displays node tree with folders', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.getFolder('sampling')).toBeVisible()
  })

  test('Can expand folder and see nodes in All tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.expandFolder('sampling')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()
  })

  test('Search filters nodes in All tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.getNode('KSampler (Advanced)')).not.toBeVisible()

    await tab.searchInput.fill('KSampler')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible({
      timeout: 5000
    })
    await expect(tab.getNode('CLIPLoader')).not.toBeVisible()
  })

  test('Drag node to canvas adds it', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.expandFolder('sampling')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()

    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    const canvasBoundingBox = await comfyPage.page
      .locator('#graph-canvas')
      .boundingBox()
    expect(canvasBoundingBox).not.toBeNull()
    const targetPosition = {
      x: canvasBoundingBox!.x + canvasBoundingBox!.width / 2,
      y: canvasBoundingBox!.y + canvasBoundingBox!.height / 2
    }

    const nodeLocator = tab.getNode('KSampler (Advanced)')
    await nodeLocator.dragTo(comfyPage.page.locator('#graph-canvas'), {
      targetPosition
    })

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount + 1)
  })

  test('Right-click node shows context menu with bookmark option', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.expandFolder('sampling')
    const node = tab.getNode('KSampler (Advanced)')
    await expect(node).toBeVisible()

    await node.click({ button: 'right' })

    const contextMenu = comfyPage.page.getByRole('menuitem', {
      name: /Bookmark Node/
    })
    await expect(contextMenu).toBeVisible({ timeout: 3000 })
  })

  test('Search clear restores folder view', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.getFolder('sampling')).toBeVisible()

    await tab.searchInput.fill('KSampler')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible({
      timeout: 5000
    })

    await tab.searchInput.clear()
    await tab.searchInput.press('Enter')

    await expect(tab.getFolder('sampling')).toBeVisible({ timeout: 5000 })
  })

  test('Sort dropdown shows sorting options', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.sortButton.click()

    // Reka UI DropdownMenuRadioItem renders with role="menuitemradio"
    const options = comfyPage.page.getByRole('menuitemradio')
    await expect(options.first()).toBeVisible({ timeout: 3000 })
    await expect.poll(() => options.count()).toBeGreaterThanOrEqual(2)
  })
})
