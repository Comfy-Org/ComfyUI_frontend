import { test as base } from '@playwright/test'

import type { AssetHelper } from '@e2e/fixtures/helpers/AssetHelper'
import { createAssetHelper } from '@e2e/fixtures/helpers/AssetHelper'

export const assetApiFixture = base.extend<{
  assetApi: AssetHelper
}>({
  assetApi: async ({ page }, use) => {
    const assetApi = createAssetHelper(page)

    await use(assetApi)

    await assetApi.clearMocks()
  }
})
