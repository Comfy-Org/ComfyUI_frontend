import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test('Sidebar close button closes the panel and clears its sidebar icon', async ({
  comfyPage
}) => {
  const { menu } = comfyPage
  const tabs = {
    'node library header': menu.nodeLibraryTabV2,
    'shared tab template': menu.workflowsTab
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
