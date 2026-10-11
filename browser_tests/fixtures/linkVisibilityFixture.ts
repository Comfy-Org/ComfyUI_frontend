import { mergeTests } from '@playwright/test'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { LinkVisibilityHelper } from '@e2e/fixtures/helpers/LinkVisibilityHelper'

const linkVisibilityFixture = base.extend<{
  comfyPage: ComfyPage
  linkVisibility: LinkVisibilityHelper
}>({
  linkVisibility: async ({ comfyPage }, use) => {
    await use(new LinkVisibilityHelper(comfyPage))
  }
})

export const test = mergeTests(comfyPageFixture, linkVisibilityFixture)
