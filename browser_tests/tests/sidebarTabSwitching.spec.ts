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
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await expect(tab.selectedTabButton).toBeVisible()
  })

  test('Clicking workflows tab opens it', async ({ comfyPage }) => {
    await comfyPage.menu.workflowsTab.open()
    await expect(comfyPage.menu.workflowsTab.selectedTabButton).toBeVisible()
  })

  test('Switching from one tab to another deselects the first', async ({
    comfyPage
  }) => {
    const nodeTab = comfyPage.menu.nodeLibraryTabV2
    await nodeTab.open()
    await expect(nodeTab.selectedTabButton).toBeVisible()

    await comfyPage.menu.workflowsTab.open()
    await expect(comfyPage.menu.workflowsTab.selectedTabButton).toBeVisible()
    await expect(nodeTab.selectedTabButton).toBeHidden()
  })

  test('Clicking active tab closes the sidebar panel', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await expect(tab.selectedTabButton).toBeVisible()

    await tab.close()
    await expect(tab.selectedTabButton).toBeHidden()
  })

  test('Sidebar content area updates when switching tabs', async ({
    comfyPage
  }) => {
    const nodeTab = comfyPage.menu.nodeLibraryTabV2
    await nodeTab.open()
    await expect(nodeTab.searchInput).toBeVisible()

    await comfyPage.menu.workflowsTab.open()
    await expect(comfyPage.menu.workflowsTab.root).toBeVisible()
    await expect(nodeTab.searchInput).toBeHidden()
  })
})
