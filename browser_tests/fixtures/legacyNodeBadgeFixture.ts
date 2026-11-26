import { mergeTests } from '@playwright/test'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { LegacyNodeBadgeHelper } from '@e2e/fixtures/helpers/LegacyNodeBadgeHelper'

const legacyNodeBadgeFixture = base.extend<{
  legacyNodeBadges: LegacyNodeBadgeHelper
}>({
  legacyNodeBadges: async ({ page }, use) => {
    await use(new LegacyNodeBadgeHelper(page))
  }
})

export const test = mergeTests(comfyPageFixture, legacyNodeBadgeFixture)
