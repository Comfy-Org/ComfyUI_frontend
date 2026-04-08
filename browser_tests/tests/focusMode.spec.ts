import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Focus Mode', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  test('Focus mode hides UI chrome', async ({ comfyPage }) => {
    await expect(comfyPage.menu.sideToolbar).toBeVisible()

    await comfyPage.setFocusMode(true)

    await expect(comfyPage.menu.sideToolbar).not.toBeVisible()
  })

  test('Focus mode restores UI chrome', async ({ comfyPage }) => {
    await comfyPage.setFocusMode(true)
    await expect(comfyPage.menu.sideToolbar).not.toBeVisible()

    await comfyPage.setFocusMode(false)
    await expect(comfyPage.menu.sideToolbar).toBeVisible()
  })

  test('Toggle focus mode command works', async ({ comfyPage }) => {
    await expect(comfyPage.menu.sideToolbar).toBeVisible()

    await comfyPage.command.executeCommand('Workspace.ToggleFocusMode')
    await comfyPage.nextFrame()
    await expect(comfyPage.menu.sideToolbar).not.toBeVisible()

    await comfyPage.command.executeCommand('Workspace.ToggleFocusMode')
    await comfyPage.nextFrame()
    await expect(comfyPage.menu.sideToolbar).toBeVisible()
  })

  test('Focus mode hides topbar', async ({ comfyPage }) => {
    const topMenu = comfyPage.page.locator('.comfy-menu-button-wrapper')
    await expect(topMenu).toBeVisible()

    await comfyPage.setFocusMode(true)

    await expect(topMenu).not.toBeVisible()
  })

  test('Canvas remains visible in focus mode', async ({ comfyPage }) => {
    await comfyPage.setFocusMode(true)

    await expect(comfyPage.canvas).toBeVisible()
  })

  test('Focus mode can be toggled multiple times', async ({ comfyPage }) => {
    await comfyPage.setFocusMode(true)
    await expect(comfyPage.menu.sideToolbar).not.toBeVisible()

    await comfyPage.setFocusMode(false)
    await expect(comfyPage.menu.sideToolbar).toBeVisible()

    await comfyPage.setFocusMode(true)
    await expect(comfyPage.menu.sideToolbar).not.toBeVisible()
  })
})
