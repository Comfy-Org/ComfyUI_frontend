import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Sidebar tab switching', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  test('Sidebar toolbar is visible', async ({ comfyPage }) => {
    await expect(comfyPage.menu.sideToolbar).toBeVisible()
  })

  test('Sidebar has multiple tab buttons', async ({ comfyPage }) => {
    await expect.poll(() => comfyPage.menu.buttons.count()).toBeGreaterThan(1)
  })

  test('Clicking node library tab opens it', async ({ comfyPage }) => {
    await comfyPage.menu.nodeLibraryTab.open()
    await expect(comfyPage.menu.nodeLibraryTab.selectedTabButton).toBeVisible()
  })

  test('Clicking workflows tab opens it', async ({ comfyPage }) => {
    await comfyPage.menu.workflowsTab.open()
    await expect(comfyPage.menu.workflowsTab.selectedTabButton).toBeVisible()
  })

  test('Switching from one tab to another deselects the first', async ({
    comfyPage
  }) => {
    await comfyPage.menu.nodeLibraryTab.open()
    await expect(comfyPage.menu.nodeLibraryTab.selectedTabButton).toBeVisible()

    await comfyPage.menu.workflowsTab.open()
    await expect(comfyPage.menu.workflowsTab.selectedTabButton).toBeVisible()
    await expect(comfyPage.menu.nodeLibraryTab.selectedTabButton).toBeHidden()
  })

  test('Clicking active tab closes the sidebar panel', async ({
    comfyPage
  }) => {
    await comfyPage.menu.nodeLibraryTab.open()
    await expect(comfyPage.menu.nodeLibraryTab.selectedTabButton).toBeVisible()

    await comfyPage.menu.nodeLibraryTab.close()
    await expect(comfyPage.menu.nodeLibraryTab.selectedTabButton).toBeHidden()
  })

  test('Sidebar content area updates when switching tabs', async ({
    comfyPage
  }) => {
    await comfyPage.menu.nodeLibraryTab.open()
    await expect(comfyPage.menu.nodeLibraryTab.nodeLibraryTree).toBeVisible()

    await comfyPage.menu.workflowsTab.open()
    await expect(comfyPage.menu.workflowsTab.root).toBeVisible()
    await expect(comfyPage.menu.nodeLibraryTab.nodeLibraryTree).toBeHidden()
  })
})
