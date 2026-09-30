import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Sidebar close button', () => {
  test.use({ initialSettings: { 'Comfy.Queue.QPOV2': true } })

  test('closes each core panel and clears its sidebar icon', async ({
    comfyPage
  }) => {
    const { menu } = comfyPage
    const tabs = {
      'node library': menu.nodeLibraryTabV2,
      'model library': menu.modelLibraryTab,
      workflows: menu.workflowsTab,
      'job history': menu.jobHistoryTab
    }

    for (const [name, tab] of Object.entries(tabs)) {
      await test.step(name, async () => {
        await tab.open()
        await expect(tab.selectedTabButton).toBeVisible()

        await tab.closeButton.click()

        await expect(tab.closeButton).toBeHidden()
        await expect(tab.selectedTabButton).toBeHidden()
      })
    }
  })
})
