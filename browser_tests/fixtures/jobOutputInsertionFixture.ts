import { createCloudAssetsFixture } from '@e2e/fixtures/assetApiFixture'
import {
  jobOutputInsertionAssets,
  jobOutputInsertionJobs
} from '@e2e/fixtures/data/jobOutputInsertion'
import { JobsRouteMocker } from '@e2e/fixtures/jobsRouteFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

export const jobOutputInsertionTest = createCloudAssetsFixture(
  jobOutputInsertionAssets
).extend({
  page: async ({ page }, use) => {
    const jobsApi = new JobsRouteMocker(page)

    await mockCloudBoot(page, {
      features: {},
      settings: {
        'Comfy.Queue.QPOV2': false,
        'Comfy.RightSidePanel.ShowErrorsTab': true,
        'Comfy.TutorialCompleted': true,
        'Comfy.UseNewMenu': 'Top',
        'Comfy.VersionCompatibility.DisableWarnings': true
      }
    })
    await mockBilling(page)
    await jobsApi.mockJobsScenario({
      history: jobOutputInsertionJobs,
      queue: []
    })
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(page)

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})
