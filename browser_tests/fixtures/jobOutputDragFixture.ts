import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  finishedImage,
  finishedMediaJobs
} from '@e2e/fixtures/data/finishedMediaJobs'
import { jobsRouteFixture } from '@e2e/fixtures/jobsRouteFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

export const jobOutputDragTest = mergeTests(
  comfyPageFixture,
  jobsRouteFixture
).extend<{
  finishedJobs: void
}>({
  finishedJobs: [
    async ({ jobsRoutes, page }, use) => {
      await jobsRoutes.mockJobsScenario({
        history: [...finishedMediaJobs],
        queue: []
      })
      await page.route(
        (url) =>
          url.pathname.endsWith('/view') &&
          url.searchParams.get('filename') === finishedImage.filename,
        (route) =>
          route.fulfill({
            path: assetPath('test_upload_image.png'),
            contentType: 'image/png'
          })
      )
      await page.route(
        (url) =>
          url.pathname.endsWith('/view') &&
          url.searchParams.get('filename') === 'input_clip.mp4',
        (route) =>
          route.fulfill({
            path: assetPath('plain_video.mp4'),
            contentType: 'video/mp4'
          })
      )
      await use()
    },
    { auto: true }
  ]
})
