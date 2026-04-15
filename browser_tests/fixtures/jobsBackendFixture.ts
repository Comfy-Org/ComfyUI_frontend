import { test as base } from '@playwright/test'

import { InMemoryJobsBackend } from '@e2e/fixtures/helpers/InMemoryJobsBackend'

export const jobsBackendFixture = base.extend<{
  jobsBackend: InMemoryJobsBackend
}>({
  jobsBackend: async ({ page }, use) => {
    const jobsBackend = new InMemoryJobsBackend(page)

    await use(jobsBackend)

    await jobsBackend.clear()
  }
})
