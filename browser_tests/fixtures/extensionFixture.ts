import { mergeTests } from '@playwright/test'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExtensionHelper } from '@e2e/fixtures/helpers/ExtensionHelper'

const extensionHelperFixture = base.extend<{
  extensions: ExtensionHelper
}>({
  extensions: async ({ page }, use) => {
    await use(new ExtensionHelper(page))
  }
})

export const extensionTest = mergeTests(
  comfyPageFixture,
  extensionHelperFixture
)
