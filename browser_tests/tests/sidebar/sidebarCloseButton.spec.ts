import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const cases = [
  {
    name: 'node library',
    newNodeLibrary: true,
    tab: (comfyPage: ComfyPage) => comfyPage.menu.nodeLibraryTabV2
  },
  {
    name: 'legacy node library',
    newNodeLibrary: false,
    tab: (comfyPage: ComfyPage) => comfyPage.menu.nodeLibraryTab
  },
  {
    name: 'model library',
    newNodeLibrary: true,
    tab: (comfyPage: ComfyPage) => comfyPage.menu.modelLibraryTab
  },
  {
    name: 'workflows',
    newNodeLibrary: true,
    tab: (comfyPage: ComfyPage) => comfyPage.menu.workflowsTab
  }
]

for (const { name, newNodeLibrary, tab } of cases) {
  test.describe(`${name} sidebar close button`, () => {
    test.use({
      initialSettings: { 'Comfy.NodeLibrary.NewDesign': newNodeLibrary }
    })

    test('closes the panel and clears the sidebar icon', async ({
      comfyPage
    }) => {
      const sidebarTab = tab(comfyPage)
      await sidebarTab.open()
      await expect(sidebarTab.selectedTabButton).toBeVisible()

      await sidebarTab.closeButton.click()

      await expect(sidebarTab.closeButton).toBeHidden()
      await expect(sidebarTab.selectedTabButton).toBeHidden()
    })
  })
}
