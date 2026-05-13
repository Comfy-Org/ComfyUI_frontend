import { test as base } from '@playwright/test'

import { JobsApiMock } from '@e2e/fixtures/helpers/JobsApiMock'

export const jobsApiMockFixture = base.extend<{
  jobsApi: JobsApiMock
}>({
  jobsApi: async ({ page }, use) => {
    const jobsApi = new JobsApiMock(page)

    await use(jobsApi)

    await jobsApi.clear()
  }
})
