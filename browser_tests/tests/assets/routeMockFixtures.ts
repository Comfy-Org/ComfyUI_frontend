import type { Page } from '@playwright/test'

import type { JobsRouteMocker } from '@e2e/fixtures/jobsRouteFixture'
import {
  createRouteMockJob,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import type {
  JobDetail,
  RawJobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'

export const alphaJob = createRouteMockJob({
  id: 'alpha',
  create_time: routeMockJobTimestamp - 1_000,
  execution_start_time: routeMockJobTimestamp - 1_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'alpha.png',
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType: 'images'
  }
})

export const betaJob = createRouteMockJob({
  id: 'beta',
  create_time: routeMockJobTimestamp - 2_000,
  execution_start_time: routeMockJobTimestamp - 2_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'beta.png',
    subfolder: '',
    type: 'output',
    nodeId: '2',
    mediaType: 'images'
  }
})

export const multiOutputJob = createRouteMockJob({
  id: 'multi-output',
  create_time: routeMockJobTimestamp - 3_000,
  execution_start_time: routeMockJobTimestamp - 3_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'multi-output-a.png',
    subfolder: '',
    type: 'output',
    nodeId: '3',
    mediaType: 'images'
  },
  outputs_count: 2
})

export const multiOutputJobDetail: JobDetail = {
  ...multiOutputJob,
  outputs: {
    '3': {
      images: [
        {
          filename: 'multi-output-a.png',
          subfolder: '',
          type: 'output'
        },
        {
          filename: 'multi-output-b.png',
          subfolder: '',
          type: 'output'
        }
      ]
    }
  }
}

export const previewableCountJob = createRouteMockJob({
  id: 'previewable-count-job',
  create_time: routeMockJobTimestamp - 4_000,
  execution_start_time: routeMockJobTimestamp - 4_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'previewable-count-a.png',
    subfolder: '',
    type: 'output',
    nodeId: '4',
    mediaType: 'images'
  },
  outputs_count: 3,
  previewable_outputs_count: 2
})

export const previewableCountJobDetail: JobDetail = {
  ...previewableCountJob,
  outputs: {
    '4': {
      images: [
        {
          filename: 'previewable-count-a.png',
          subfolder: '',
          type: 'output'
        },
        {
          filename: 'previewable-count-b.png',
          subfolder: '',
          type: 'output'
        }
      ],
      latents: [
        {
          filename: 'previewable-count.latent',
          subfolder: '',
          type: 'output'
        }
      ]
    }
  }
}

export const generatedJobs: RawJobListItem[] = [alphaJob, betaJob]

export const viewFiles = {
  'alpha.png': {},
  'beta.png': {},
  'imported.png': {},
  'multi-output-a.png': {},
  'multi-output-b.png': {},
  'previewable-count-a.png': {},
  'previewable-count-b.png': {}
}

export async function mockInputFiles(page: Page, files: readonly string[]) {
  await page.route('**/internal/files/input**', async (route) => {
    if (route.request().method().toUpperCase() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({ json: [...files] })
  })
}

export async function mockGeneratedSidebarRoutes(
  page: Page,
  jobsRoutes: JobsRouteMocker,
  inputFiles: readonly string[] = ['imported.png']
) {
  await jobsRoutes.mockJobsQueue([])
  await jobsRoutes.mockJobsHistory(generatedJobs)
  await mockInputFiles(page, inputFiles)
  await mockViewFiles(page, viewFiles)
}
