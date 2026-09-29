import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { SidebarTab } from '@e2e/fixtures/components/SidebarTab'

const cases: {
  name: string
  settings?: Record<string, boolean>
  tab: (comfyPage: ComfyPage) => SidebarTab
}[] = [
  {
    name: 'node library',
    tab: (comfyPage) => comfyPage.menu.nodeLibraryTabV2
  },
  {
    name: 'legacy node library',
    settings: { 'Comfy.NodeLibrary.NewDesign': false },
    tab: (comfyPage) => comfyPage.menu.nodeLibraryTab
  },
  {
    name: 'model library',
    tab: (comfyPage) => comfyPage.menu.modelLibraryTab
  },
  {
    name: 'workflows',
    tab: (comfyPage) => comfyPage.menu.workflowsTab
  },
  {
    name: 'job history',
    settings: { 'Comfy.Queue.QPOV2': true },
    tab: (comfyPage) => new SidebarTab(comfyPage.page, 'job-history')
  }
]

for (const { name, settings, tab } of cases) {
  test.describe(`${name} sidebar close button`, () => {
    if (settings) test.use({ initialSettings: settings })

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
