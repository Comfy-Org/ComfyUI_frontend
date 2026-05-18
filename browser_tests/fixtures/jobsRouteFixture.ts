import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { z } from 'zod'

import type {
  JobStatus,
  RawJobListItem,
  zJobsListResponse
} from '@/platform/remote/comfyui/jobs/jobTypes'

type JobsListResponse = z.infer<typeof zJobsListResponse>

const terminalJobStatuses = [
  'completed',
  'failed',
  'cancelled'
] as const satisfies readonly JobStatus[]
const activeJobStatuses = [
  'in_progress',
  'pending'
] as const satisfies readonly JobStatus[]
const defaultJobsListLimit = 200
const defaultScenarioHistoryLimit = 64
const defaultJobsListOffset = 0
const defaultRouteMockJobTimestamp = Date.UTC(2026, 0, 1, 12)

interface JobsListRoute {
  statuses: readonly JobStatus[]
  jobs: readonly RawJobListItem[]
  limit?: number
  offset?: number
  responseLimit?: number
}

interface JobsScenario {
  history?: readonly RawJobListItem[]
  queue?: readonly RawJobListItem[]
}

function hasExactStatuses(url: URL, statuses: readonly JobStatus[]): boolean {
  const requestedStatuses = new Set(
    url.searchParams.get('status')?.split(',') ?? []
  )

  return (
    requestedStatuses.size === statuses.length &&
    statuses.every((status) => requestedStatuses.has(status))
  )
}

function searchParamNumber(url: URL, name: string, fallback: number): number {
  const value = url.searchParams.get(name)
  return value === null ? fallback : Number(value)
}

function hasJobsListPageParams(
  url: URL,
  { limit, offset }: Pick<JobsListRoute, 'limit' | 'offset'>
): boolean {
  return (
    searchParamNumber(url, 'limit', defaultJobsListLimit) ===
      (limit ?? defaultJobsListLimit) &&
    searchParamNumber(url, 'offset', defaultJobsListOffset) ===
      (offset ?? defaultJobsListOffset)
  )
}

function isJobsListRequest(url: URL, route: JobsListRoute): boolean {
  return (
    url.pathname.endsWith('/api/jobs') &&
    hasExactStatuses(url, route.statuses) &&
    hasJobsListPageParams(url, route)
  )
}

function createJobsListResponse({
  jobs,
  limit = defaultJobsListLimit,
  offset = defaultJobsListOffset,
  responseLimit = limit
}: Omit<JobsListRoute, 'statuses'>): JobsListResponse {
  const pageJobs = jobs.slice(offset, offset + responseLimit)

  return {
    jobs: pageJobs,
    pagination: {
      offset,
      limit: responseLimit,
      total: jobs.length,
      has_more: offset + pageJobs.length < jobs.length
    }
  }
}

export function createRouteMockJob({
  id,
  ...overrides
}: { id: string } & Partial<Omit<RawJobListItem, 'id'>>): RawJobListItem {
  return {
    id,
    status: 'completed',
    create_time: defaultRouteMockJobTimestamp,
    execution_start_time: defaultRouteMockJobTimestamp,
    execution_end_time: defaultRouteMockJobTimestamp + 5_000,
    preview_output: {
      filename: `output_${id}.png`,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1,
    ...overrides
  }
}

export class JobsRouteMocker {
  constructor(private readonly page: Page) {}

  async mockJobsHistory(
    jobs: readonly RawJobListItem[],
    limit = defaultJobsListLimit,
    options: Pick<JobsListRoute, 'responseLimit'> = {}
  ): Promise<void> {
    await this.mockJobsList({
      statuses: terminalJobStatuses,
      jobs,
      limit,
      ...options
    })
  }

  async mockJobsQueue(jobs: readonly RawJobListItem[]): Promise<void> {
    await this.mockJobsList({
      statuses: activeJobStatuses,
      jobs
    })
  }

  async mockJobsScenario({ history, queue }: JobsScenario): Promise<void> {
    if (history) {
      await this.mockJobsHistory(history, defaultScenarioHistoryLimit)
    }
    if (queue) {
      await this.mockJobsQueue(queue)
    }
  }

  async mockJobsList(route: JobsListRoute): Promise<void> {
    const response = createJobsListResponse(route)

    await this.page.route(
      (url) => isJobsListRequest(url, route),
      async (requestRoute) => {
        if (requestRoute.request().method().toUpperCase() !== 'GET') {
          await requestRoute.fallback()
          return
        }

        await requestRoute.fulfill({ json: response })
      }
    )
  }
}

export const jobsRouteFixture = base.extend<{
  jobsRoutes: JobsRouteMocker
}>({
  jobsRoutes: async ({ page }, use) => {
    await use(new JobsRouteMocker(page))
    await page.unrouteAll({ behavior: 'wait' })
  }
})
