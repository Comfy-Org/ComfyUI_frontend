import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Sidebar tab switching', { tag: '@ui' }, () => {
  test('Switching tabs replaces the active panel', async ({ comfyPage }) => {
    const nodeLibrary = comfyPage.menu.nodeLibraryTabV2
    const workflows = comfyPage.menu.workflowsTab

    await test.step('Open the node library', async () => {
      await nodeLibrary.open()
      await expect(nodeLibrary.selectedTabButton).toBeVisible()
      await expect(nodeLibrary.searchInput).toBeVisible()
    })

    await test.step('Switch to workflows', async () => {
      await workflows.open()
      await expect(workflows.selectedTabButton).toBeVisible()
      await expect(workflows.root).toBeVisible()
      await expect(nodeLibrary.selectedTabButton).toBeHidden()
      await expect(nodeLibrary.searchInput).toBeHidden()
    })
  })

  test('Clicking the active tab closes its panel', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await expect(tab.selectedTabButton).toBeVisible()
    await expect(tab.searchInput).toBeVisible()

    await tab.close()
    await expect(tab.selectedTabButton).toBeHidden()
    await expect(tab.searchInput).toBeHidden()
  })
})
