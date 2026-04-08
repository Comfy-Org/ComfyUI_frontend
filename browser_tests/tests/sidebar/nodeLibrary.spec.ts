import { expect } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

const bookmarksSettingId = 'Comfy.NodeLibrary.Bookmarks.V2'
const bookmarksCustomizationSettingId =
  'Comfy.NodeLibrary.BookmarksCustomization'

type BookmarkCustomizationMap = Record<
  string,
  {
    icon?: string
    color?: string
  }
>

async function expectBookmarks(comfyPage: ComfyPage, bookmarks: string[]) {
  await expect
    .poll(() => comfyPage.settings.getSetting<string[]>(bookmarksSettingId))
    .toEqual(bookmarks)
}

async function expectBookmarkCustomization(
  comfyPage: ComfyPage,
  customization: BookmarkCustomizationMap
) {
  await expect
    .poll(() =>
      comfyPage.settings.getSetting<BookmarkCustomizationMap>(
        bookmarksCustomizationSettingId
      )
    )
    .toEqual(customization)
}

async function renameInlineFolder(comfyPage: ComfyPage, newName: string) {
  const renameInput = comfyPage.page.locator('.editable-text input')
  await expect(renameInput).toBeVisible()
  await renameInput.fill(newName)
  await renameInput.press('Enter')
}

test.describe('Node library sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)
    await comfyPage.settings.setSetting(bookmarksSettingId, [])
    await comfyPage.settings.setSetting(bookmarksCustomizationSettingId, {})
    // Open the sidebar
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()
  })

  test('Node preview and drag to canvas', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.getFolder('sampling').click()

    // Hover over a node to display the preview
    const nodeSelector = tab.nodeSelector('KSampler (Advanced)')
    await comfyPage.page.hover(nodeSelector)

    // Verify the preview is displayed
    await expect(tab.nodePreview).toBeVisible()

    const count = await comfyPage.nodeOps.getGraphNodesCount()
    // Drag the node onto the canvas
    const canvasSelector = '#graph-canvas'

    // Get the bounding box of the canvas element
    const canvasBoundingBox = (await comfyPage.page
      .locator(canvasSelector)
      .boundingBox())!

    // Calculate the center position of the canvas
    const targetPosition = {
      x: canvasBoundingBox.x + canvasBoundingBox.width / 2,
      y: canvasBoundingBox.y + canvasBoundingBox.height / 2
    }

    await comfyPage.page.dragAndDrop(nodeSelector, canvasSelector, {
      targetPosition
    })
    await comfyPage.nextFrame()

    // Verify the node is added to the canvas
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(count + 1)
  })

  test('Bookmark node', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.getFolder('sampling').click()

    // Bookmark the node
    await tab.getNode('KSampler (Advanced)').locator('.bookmark-button').click()

    // Verify the bookmark is added to the bookmarks tab
    await expectBookmarks(comfyPage, ['KSamplerAdvanced'])
    // Verify the bookmark node with the same name is added to the tree.
    await expect(tab.getNode('KSampler (Advanced)')).toHaveCount(2)

    // Hover on the bookmark node to display the preview
    await comfyPage.page.hover('.node-lib-bookmark-tree-explorer .tree-leaf')
    await expect(tab.nodePreview).toBeVisible()
  })

  test('Ignores unrecognized node', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo'])
    await expectBookmarks(comfyPage, ['foo'])
    await comfyPage.nextFrame()

    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('sampling')).toHaveCount(1)
    await expect(tab.getNode('foo')).toHaveCount(0)
  })

  test('Displays empty bookmarks folder', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toHaveCount(1)
  })

  test('Can add new bookmark folder', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.newFolderButton.click()
    const textInput = comfyPage.page.locator('.editable-text input')
    await textInput.waitFor({ state: 'visible' })
    await textInput.fill('New Folder')
    await textInput.press('Enter')
    await expect(tab.getFolder('New Folder')).toHaveCount(1)
    await expectBookmarks(comfyPage, ['New Folder/'])
  })

  test('Can add nested bookmark folder', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()

    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page.getByRole('menuitem', { name: 'New Folder' }).click()
    const textInput = comfyPage.page.locator('.editable-text input')
    await textInput.waitFor({ state: 'visible' })
    await textInput.fill('bar')
    await textInput.press('Enter')

    await expect(tab.getFolder('bar')).toHaveCount(1)
    await expectBookmarks(comfyPage, ['foo/', 'foo/bar/'])
  })

  test('Can delete bookmark folder', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()

    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page.getByLabel('Delete').click()

    await expectBookmarks(comfyPage, [])
  })

  test('Can rename bookmark folder', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()

    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu-item-label:has-text("Rename")')
      .click()
    await renameInlineFolder(comfyPage, 'bar')

    await expectBookmarks(comfyPage, ['bar/'])
  })

  test('Can add bookmark by dragging node to bookmark folder', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()
    await tab.getFolder('sampling').click()
    await comfyPage.page.dragAndDrop(
      tab.nodeSelector('KSampler (Advanced)'),
      tab.folderSelector('foo')
    )
    await expectBookmarks(comfyPage, ['foo/', 'foo/KSamplerAdvanced'])
  })

  test('Can add bookmark by clicking bookmark button', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.getFolder('sampling').click()
    await tab.getNode('KSampler (Advanced)').locator('.bookmark-button').click()
    await expectBookmarks(comfyPage, ['KSamplerAdvanced'])
  })

  test('Can unbookmark node (Top level bookmark)', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, [
      'KSamplerAdvanced'
    ])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getNode('KSampler (Advanced)')).toHaveCount(1)
    await tab.getNode('KSampler (Advanced)').locator('.bookmark-button').click()
    await expectBookmarks(comfyPage, [])
  })

  test('Can unbookmark node (Library node bookmark)', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, [
      'KSamplerAdvanced'
    ])
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.getFolder('sampling').click()
    await expect(tab.getNode('KSampler (Advanced)')).toHaveCount(2)
    await tab
      .getNodeInFolder('KSampler (Advanced)', 'sampling')
      .locator('.bookmark-button')
      .click()
    await expectBookmarks(comfyPage, [])
  })
  test('Can customize icon', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()
    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page.getByLabel('Customize').click()
    const dialog = comfyPage.page.getByRole('dialog', {
      name: 'Customize Folder'
    })
    // Select Folder icon (2nd button in Icon group)
    const iconGroup = dialog.getByText('Icon').locator('..').getByRole('group')
    await iconGroup.getByRole('button').nth(1).click()
    // Select Blue color (2nd button in Color group)
    const colorGroup = dialog
      .getByText('Color')
      .locator('..')
      .getByRole('group')
    await colorGroup.getByRole('button').nth(1).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await comfyPage.nextFrame()
    await expectBookmarkCustomization(comfyPage, {
      'foo/': {
        icon: 'pi-folder',
        color: '#007bff'
      }
    })
  })
  // If color is left as default, it should not be saved
  test('Can customize icon (default field)', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()
    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page.getByLabel('Customize').click()
    const dialog = comfyPage.page.getByRole('dialog', {
      name: 'Customize Folder'
    })
    // Select Folder icon (2nd button in Icon group)
    const iconGroup = dialog.getByText('Icon').locator('..').getByRole('group')
    await iconGroup.getByRole('button').nth(1).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await comfyPage.nextFrame()
    await expectBookmarkCustomization(comfyPage, {
      'foo/': {
        icon: 'pi-folder'
      }
    })
  })

  test('Can customize bookmark color after interacting with color options', async ({
    comfyPage
  }) => {
    // Open customization dialog
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()
    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page.getByLabel('Customize').click()

    // Click a color option multiple times
    const customColorOption = comfyPage.page.locator(
      '.p-togglebutton-content > .pi-palette'
    )
    await customColorOption.click()
    await customColorOption.click()

    // Use the color picker
    await comfyPage.page
      .getByLabel('Customize Folder')
      .getByRole('textbox')
      .click()
    await comfyPage.page.locator('.p-colorpicker-color-background').click()

    // Finalize the customization
    const dialog = comfyPage.page.getByRole('dialog', {
      name: 'Customize Folder'
    })
    // Select Folder icon (2nd button in Icon group)
    const iconGroup = dialog.getByText('Icon').locator('..').getByRole('group')
    await iconGroup.getByRole('button').nth(1).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await comfyPage.nextFrame()

    // Verify the color selection is saved
    await expect
      .poll(async () => {
        return (
          (
            await comfyPage.settings.getSetting<BookmarkCustomizationMap>(
              bookmarksCustomizationSettingId
            )
          )['foo/']?.color ?? ''
        )
      })
      .toMatch(/^#.+/)
  })

  test('Can rename customized bookmark folder', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    await comfyPage.settings.setSetting(bookmarksCustomizationSettingId, {
      'foo/': {
        icon: 'pi-folder',
        color: '#007bff'
      }
    })
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()
    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu-item-label:has-text("Rename")')
      .click()
    await renameInlineFolder(comfyPage, 'bar')
    await comfyPage.nextFrame()
    await expect
      .poll(async () => {
        return {
          bookmarks:
            await comfyPage.settings.getSetting<string[]>(bookmarksSettingId),
          customization:
            await comfyPage.settings.getSetting<BookmarkCustomizationMap>(
              bookmarksCustomizationSettingId
            )
        }
      })
      .toEqual({
        bookmarks: ['bar/'],
        customization: {
          'bar/': {
            icon: 'pi-folder',
            color: '#007bff'
          }
        }
      })
  })

  test('Can delete customized bookmark folder', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, ['foo/'])
    await comfyPage.settings.setSetting(bookmarksCustomizationSettingId, {
      'foo/': {
        icon: 'pi-folder',
        color: '#007bff'
      }
    })
    const tab = comfyPage.menu.nodeLibraryTab
    await expect(tab.getFolder('foo')).toBeVisible()
    await tab.getFolder('foo').click({ button: 'right' })
    await comfyPage.page.getByLabel('Delete').click()
    await comfyPage.nextFrame()
    await expectBookmarks(comfyPage, [])
    await expectBookmarkCustomization(comfyPage, {})
  })

  test('Can filter nodes in both trees', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(bookmarksSettingId, [
      'foo/',
      'foo/KSamplerAdvanced',
      'KSampler'
    ])

    const tab = comfyPage.menu.nodeLibraryTab
    await tab.nodeLibrarySearchBoxInput.fill('KSampler')
    await expect(tab.getNode('KSampler (Advanced)')).toHaveCount(2)
  })
})
