import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExtensionHelper } from '@e2e/fixtures/helpers/ExtensionHelper'

export const extensionTest = comfyPageFixture.extend<{
  extensions: ExtensionHelper
}>({
  extensions: async ({ page }, use) => {
    await use(new ExtensionHelper(page))
  }
})
