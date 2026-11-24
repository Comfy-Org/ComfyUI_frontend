import { expect } from '@playwright/test'

import { comfyPageFixture as base } from '@e2e/fixtures/ComfyPage'
import type { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

export const previewImageNodeFixture = base.extend<{
  addPreviewImageNode: () => Promise<VueNodeFixture>
  downloads: string[]
}>({
  addPreviewImageNode: async ({ comfyPage }, use) => {
    await use(async () => {
      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.nextFrame()

      await comfyPage.searchBoxV2.addNode('Preview Image')
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Preview Image')
      ).toBeVisible()

      return comfyPage.vueNodes.getFixtureByTitle('Preview Image')
    })
  },
  downloads: async ({ comfyPage }, use) => {
    const filenames: string[] = []
    const record = (download: { suggestedFilename: () => string }) => {
      filenames.push(download.suggestedFilename())
    }

    comfyPage.page.on('download', record)
    await use(filenames)
    comfyPage.page.off('download', record)
  }
})
