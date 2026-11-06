import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'
import { ZipTieHelper } from '@e2e/fixtures/helpers/ZipTieHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

const zipTieFixture = base.extend<{
  comfyPage: ComfyPage
  zipTie: ZipTieHelper
}>({
  zipTie: async ({ comfyPage }, use) => {
    const zipTie = new ZipTieHelper(comfyPage)
    const storage = new UserDataHelper(
      comfyPage.request,
      comfyPage.id,
      comfyPage.apiUrl
    )
    await storage.delete(zipTie.workflowPath)
    await zipTie.setup()
    try {
      await use(zipTie)
    } finally {
      await zipTie.releaseModifiers()
      await comfyPage.page.mouse.up()
      await storage.delete(zipTie.workflowPath)
    }
  }
})

export const test = mergeTests(comfyPageFixture, zipTieFixture)
