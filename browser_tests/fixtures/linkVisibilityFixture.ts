import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { LinkVisibilityHelper } from '@e2e/fixtures/helpers/LinkVisibilityHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { mergeTests } from '@playwright/test'

const linkVisibilityFixture = base.extend<{
  comfyPage: ComfyPage
  linkVisibility: LinkVisibilityHelper
}>({
  linkVisibility: async ({ comfyPage }, use) => {
    await use(new LinkVisibilityHelper(comfyPage))
  }
})

export const test = mergeTests(comfyPageFixture, linkVisibilityFixture)
