import { test as base } from '@playwright/test'

import { AssetScenarioHelper } from './helpers/AssetScenarioHelper'

export const assetScenarioFixture = base.extend<{
  assetScenario: AssetScenarioHelper
}>({
  assetScenario: async ({ page }, use) => {
    const assetScenario = new AssetScenarioHelper(page)

    await use(assetScenario)

    await assetScenario.clear()
  }
})
