import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

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
    const topMenu = comfyPage.page.locator('.comfy-menu-button-wrapper')
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

  test('Focus mode toggle preserves properties panel width', async ({
    comfyPage
  }) => {
    // Open the properties panel
    await comfyPage.actionbar.propertiesButton.click()
    await expect(comfyPage.menu.propertiesPanel.root).toBeVisible()

    // Record the initial panel width
    const initialBox = await comfyPage.menu.propertiesPanel.root.boundingBox()
    expect(initialBox).not.toBeNull()
    const initialWidth = initialBox!.width

    // Toggle focus mode on then off
    await comfyPage.setFocusMode(true)
    await comfyPage.setFocusMode(false)

    // Properties panel should be visible again with the same width
    await expect(comfyPage.menu.propertiesPanel.root).toBeVisible()
    await expect
      .poll(async () => {
        const box = await comfyPage.menu.propertiesPanel.root.boundingBox()
        return box ? Math.abs(box.width - initialWidth) : Infinity
      })
      .toBeLessThan(2)
  })
})
