import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

interface ZoomImages {
  first: string
  second: string
  size: number
}

const zoomImages: ZoomImages = {
  first: 'zoom-a.png',
  second: 'zoom-b.png',
  size: 200
}

function imageJob(filename: string, ageMs: number) {
  return createRouteMockJob({
    id: filename,
    create_time: routeMockJobTimestamp - ageMs,
    execution_start_time: routeMockJobTimestamp - ageMs,
    execution_end_time: routeMockJobTimestamp,
    preview_output: {
      filename,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    }
  })
}

/** Two generated 200x200 image outputs, newest first, served from test assets. */
export const mediaLightboxZoomTest = mergeTests(
  comfyPageFixture,
  jobsRouteFixture
).extend<{ zoomImages: ZoomImages }>({
  zoomImages: [
    async ({ jobsRoutes, page }, use) => {
      const jobs = [
        imageJob(zoomImages.first, 1_000),
        imageJob(zoomImages.second, 2_000)
      ]
      await jobsRoutes.mockJobsScenario({ history: jobs, queue: [] })
      await jobsRoutes.mockJobsHistory(jobs)
      await mockViewFiles(page, {
        [zoomImages.first]: {
          path: 'browser_tests/assets/agent/asset-grid-repro-a.png'
        },
        [zoomImages.second]: {
          path: 'browser_tests/assets/agent/asset-grid-repro-b.png'
        }
      })
      await use(zoomImages)
    },
    { auto: true }
  ]
})
