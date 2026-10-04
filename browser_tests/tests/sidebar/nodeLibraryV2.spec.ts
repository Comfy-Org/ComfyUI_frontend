import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Node library sidebar V2', () => {
  test.beforeEach(async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
  })

  test('All tab displays node tree with folders', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.getFolder('model')).toBeVisible()
  })

  test('Can expand folder and see nodes in All tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.expandFolder('model')
    await tab.expandFolder('sampling')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()
  })

  test('Search filters nodes in All tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.getNode('KSampler (Advanced)')).toBeHidden()

    await tab.searchInput.fill('KSampler')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()
    await expect(tab.getNode('CLIPLoader')).toBeHidden()
  })

  test('Drag node to canvas adds it', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.expandFolder('model')
    await tab.expandFolder('sampling')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()

    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await expect
      .poll(
        async () => await comfyPage.page.locator('#graph-canvas').boundingBox()
      )
      .toBeTruthy()
    const canvasBoundingBox = (await comfyPage.page
      .locator('#graph-canvas')
      .boundingBox())!
    const targetPosition = {
      x: canvasBoundingBox.x + canvasBoundingBox.width / 2,
      y: canvasBoundingBox.y + canvasBoundingBox.height / 2
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
    const menu = comfyPage.contextMenu

    await tab.expandFolder('model')
    await tab.expandFolder('sampling')
    const node = tab.getNode('KSampler (Advanced)')
    await expect(node).toBeVisible()

    await menu.openFor(node)
    await menu.hoverItem('Bookmark Node', 'content')

    const hoverStyle = await menu.getItemStyle('Bookmark Node')
    const expectedBackground = await menu.resolveBackgroundToken(
      '--secondary-background-hover'
    )
    expect.soft(hoverStyle).toEqual({
      backgroundColor: expectedBackground,
      borderRadius: '6px',
      paddingBottom: '6px',
      paddingLeft: '12px',
      paddingRight: '12px',
      paddingTop: '6px'
    })

    await menu.focusItemWithKeyboard('Bookmark Node')
    expect.soft(await menu.getItemStyle('Bookmark Node')).toEqual(hoverStyle)

    await menu.clickMenuItemExact('Bookmark Node')
    await expect(tab.getNodes('KSampler (Advanced)')).toHaveCount(2)

    await menu.openFor(tab.getNode('KSampler (Advanced)').first())
    await menu.clickMenuItemExact('Unbookmark Node')
    await expect(tab.getNodes('KSampler (Advanced)')).toHaveCount(1)
  })

  test('Search clear restores folder view', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.getFolder('model')).toBeVisible()

    await tab.searchInput.fill('KSampler')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()

    await tab.searchInput.clear()
    await tab.searchInput.press('Enter')

    await expect(tab.getFolder('model')).toBeVisible()
  })

  test('Sort dropdown shows sorting options', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.sortButton.click()

    // Reka UI DropdownMenuRadioItem renders with role="menuitemradio"
    const options = comfyPage.page.getByRole('menuitemradio')
    await expect(options.first()).toBeVisible()
    await expect.poll(() => options.count()).toBeGreaterThanOrEqual(2)
  })

  test('Blueprint previews include description', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.allTab.click()

    await tab.expandFolder('Comfy Blueprints')
    await tab.getNode('test blueprint').hover()
    await expect(tab.nodePreview, 'Preview displays on hover').toBeVisible()
    await expect(tab.nodePreview).toContainText('Inverts the image')
  })

  test('Click-to-place from sidebar selects the newly added node', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2
    await comfyPage.nodeOps.clearGraph()
    await tab.expandFolder('model')
    await tab.expandFolder('sampling')

    const canvasBox = (await comfyPage.canvas.boundingBox())!
    const target = {
      x: canvasBox.width / 2,
      y: canvasBox.height / 2
    }

    await tab.getNode('KSampler (Advanced)').click()
    await comfyPage.canvas.click({ position: target })

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
      .toBe(1)
  })
})
