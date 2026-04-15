import { jobsBackendFixture } from '@e2e/fixtures/jobsBackendFixture'
import { AssetScenarioHelper } from '@e2e/fixtures/helpers/AssetScenarioHelper'

export const assetScenarioFixture = jobsBackendFixture.extend<{
  assetScenario: AssetScenarioHelper
}>({
  assetScenario: async ({ page, jobsBackend }, use) => {
    const assetScenario = new AssetScenarioHelper(page, jobsBackend)

    await use(assetScenario)

    await assetScenario.clear()
  }
})
