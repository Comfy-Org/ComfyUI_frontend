import type { Page } from '@playwright/test'

import { AssetsHelper } from '@e2e/fixtures/helpers/AssetsHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export const assetsStartupFixture = base.extend<{
  assetMocks: {
    setup?: (assets: AssetsHelper, page: Page) => Promise<void>
  }
  startupAssets: AssetsHelper
}>({
  assetMocks: [{}, { option: true }],
  startupAssets: [
    async ({ page, assetMocks }, use) => {
      const assets = new AssetsHelper(page)
      await assetMocks.setup?.(assets, page)
      await use(assets)
      await assets.clearMocks()
    },
    { auto: true }
  ]
})
