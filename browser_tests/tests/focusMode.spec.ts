import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Focus Mode', { tag: '@ui' }, () => {
  test('Focus mode hides UI chrome', async ({ comfyPage }) => {
    await expect(comfyPage.menu.sideToolbar).toBeVisible()

    await comfyPage.setFocusMode(true)

    await expect(comfyPage.menu.sideToolbar).toBeHidden()
  })

  test('Focus mode restores UI chrome', async ({ comfyPage }) => {
    await comfyPage.setFocusMode(true)
    await expect(comfyPage.menu.sideToolbar).toBeHidden()

    await comfyPage.setFocusMode(false)
    await expect(comfyPage.menu.sideToolbar).toBeVisible()
  })

  test('Toggle focus mode command works', async ({ comfyPage }) => {
    await expect(comfyPage.menu.sideToolbar).toBeVisible()

    await comfyPage.command.executeCommand('Workspace.ToggleFocusMode')
    await expect(comfyPage.menu.sideToolbar).toBeHidden()

    await comfyPage.command.executeCommand('Workspace.ToggleFocusMode')
    await expect(comfyPage.menu.sideToolbar).toBeVisible()
  })

  test('Focus mode hides topbar', async ({ comfyPage }) => {
    const topMenu = comfyPage.page.getByRole('button', {
      name: 'Menu',
      exact: true
    })
    await expect(topMenu).toBeVisible()

    await comfyPage.setFocusMode(true)

    await expect(topMenu).toBeHidden()
  })

  test('Canvas remains visible in focus mode', async ({ comfyPage }) => {
    await comfyPage.setFocusMode(true)

    await expect(comfyPage.canvas).toBeVisible()
  })

  test('Focus mode can be toggled multiple times', async ({ comfyPage }) => {
    await comfyPage.setFocusMode(true)
    await expect(comfyPage.menu.sideToolbar).toBeHidden()

    await comfyPage.setFocusMode(false)
    await expect(comfyPage.menu.sideToolbar).toBeVisible()

    await comfyPage.setFocusMode(true)
    await expect(comfyPage.menu.sideToolbar).toBeHidden()
  })

  test('Focus mode preserves side-panel filters and width', async ({
    comfyPage
  }) => {
    const sidebar = comfyPage.menu.nodeLibraryTabV2
    const properties = new PropertiesPanelHelper(comfyPage.page)
    await sidebar.open()
    await sidebar.searchInput.fill('KSampler')
    await properties.open(comfyPage.actionbar.propertiesButton)
    await properties.searchWidgets('seed')

    const initialBox = await properties.root.boundingBox()
    expect(initialBox).not.toBeNull()
    const initialWidth = initialBox!.width

    await comfyPage.setFocusMode(true)
    await expect(sidebar.panel).toBeHidden()
    await expect(properties.root).toBeHidden()
    await comfyPage.setFocusMode(false)

    await expect(sidebar.searchInput).toHaveValue('KSampler')
    await expect(properties.searchBox).toHaveValue('seed')
    await expect(properties.root).toBeVisible()
    await expect
      .poll(async () => {
        const box = await properties.root.boundingBox()
        return box ? Math.abs(box.width - initialWidth) : Infinity
      })
      .toBeLessThan(2)
  })
})
