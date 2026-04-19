import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Node library sidebar V2', () => {
  test.beforeEach(async ({ comfyPage }) => {
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

    await expect(tab.getNode('KSampler (Advanced)')).toBeHidden()

    await tab.searchInput.fill('KSampler')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()
    await expect(tab.getNode('CLIPLoader')).toBeHidden()
  })

  test('Drag node to canvas adds it', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

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

    await tab.expandFolder('sampling')
    const node = tab.getNode('KSampler (Advanced)')
    await expect(node).toBeVisible()

    await node.click({ button: 'right' })

    const contextMenu = comfyPage.page.getByRole('menuitem', {
      name: /Bookmark Node/
    })
    await expect(contextMenu).toBeVisible()
  })

  test('Search clear restores folder view', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.getFolder('sampling')).toBeVisible()

    await tab.searchInput.fill('KSampler')
    await expect(tab.getNode('KSampler (Advanced)')).toBeVisible()

    await tab.searchInput.clear()
    await tab.searchInput.press('Enter')

    await expect(tab.getFolder('sampling')).toBeVisible()
  })

  test('Sort dropdown shows sorting options', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.sortButton.click()

    // Reka UI DropdownMenuRadioItem renders with role="menuitemradio"
    const options = comfyPage.page.getByRole('menuitemradio')
    await expect(options.first()).toBeVisible()
    await expect.poll(() => options.count()).toBeGreaterThanOrEqual(2)
  })

  test.describe('Bookmark button scrollbar overlap', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [])
    })

    test('Bookmark button right edge is within the visible panel area', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.nodeLibraryTabV2

      await tab.expandFolder('sampling')
      const node = tab.getNode('KSampler (Advanced)')
      await expect(node).toBeVisible()

      // Hover required: bookmark button uses opacity-0 → group-hover:opacity-100
      await node.hover()

      const bookmarkButton = node.getByRole('button', { name: 'Bookmark' })
      await expect(bookmarkButton).toBeVisible()

      await expect
        .poll(async () => {
          const buttonBox = await bookmarkButton.boundingBox()
          const containerBox = await tab.sidebarContent.boundingBox()
          if (!buttonBox || !containerBox) return false
          return (
            buttonBox.x + buttonBox.width <= containerBox.x + containerBox.width
          )
        })
        .toBe(true)
    })

    test('Bookmark button is clickable and toggles bookmark state', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.nodeLibraryTabV2

      await tab.expandFolder('sampling')
      const node = tab.getNode('KSampler (Advanced)')
      await expect(node).toBeVisible()

      await node.hover()
      const bookmarkButton = node.getByRole('button', { name: 'Bookmark' })
      await bookmarkButton.click()

      await expect
        .poll(() =>
          comfyPage.settings.getSetting<string[]>(
            'Comfy.NodeLibrary.Bookmarks.V2'
          )
        )
        .toContain('KSamplerAdvanced')
    })

    test('Bookmark button remains accessible after search populates results', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.nodeLibraryTabV2

      await tab.searchInput.fill('e')
      await tab.searchInput.press('Enter')

      const firstResult = tab.sidebarContent.getByRole('treeitem').first()
      await expect(firstResult).toBeVisible()

      await firstResult.hover()

      const bookmarkButton = firstResult.getByRole('button', {
        name: 'Bookmark'
      })
      await expect(bookmarkButton).toBeVisible()

      await expect
        .poll(async () => {
          const buttonBox = await bookmarkButton.boundingBox()
          const containerBox = await tab.sidebarContent.boundingBox()
          if (!buttonBox || !containerBox) return false
          return (
            buttonBox.x + buttonBox.width <= containerBox.x + containerBox.width
          )
        })
        .toBe(true)
    })
  })
})
