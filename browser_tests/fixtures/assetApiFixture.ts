import { test as base } from '@playwright/test'

import type { AssetHelper } from './helpers/AssetHelper'
import { createAssetHelper } from './helpers/AssetHelper'

export const assetApiFixture = base.extend<{
  assetApi: AssetHelper
}>({
  assetApi: async ({ page }, use) => {
    const assetApi = createAssetHelper(page)

    await use(assetApi)

    await assetApi.clearMocks()
  }
})
