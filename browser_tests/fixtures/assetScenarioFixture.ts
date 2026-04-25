import { jobsApiMockFixture } from '@e2e/fixtures/jobsApiMockFixture'
import { AssetScenarioHelper } from '@e2e/fixtures/helpers/AssetScenarioHelper'

export const assetScenarioFixture = jobsApiMockFixture.extend<{
  assetScenario: AssetScenarioHelper
}>({
  assetScenario: async ({ page, jobsApi }, use) => {
    const assetScenario = new AssetScenarioHelper(page, jobsApi)

    await use(assetScenario)

    await assetScenario.clear()
  }
})
