import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { z } from 'zod'
import {
  zHistoryManageRequest,
  zQueueManageRequest,
  zQueueManageResponse
} from '@comfyorg/ingest-types/zod'

import type {
  JobDetail,
  JobStatus,
  RawJobListItem,
  zJobsListResponse
} from '@/platform/remote/comfyui/jobs/jobTypes'

type JobsListResponse = z.infer<typeof zJobsListResponse>
type HistoryManageRequest = z.infer<typeof zHistoryManageRequest>
type QueueManageRequest = z.infer<typeof zQueueManageRequest>

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

export const routeMockJobTimestamp = Date.UTC(2026, 0, 1, 12)

interface JobsListRoute {
  statuses: readonly JobStatus[]
  jobs: readonly RawJobListItem[]
  limit?: number
  offset?: number
  responseLimit?: number
}

export interface JobsScenario {
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

function matchesJobsListRoute(url: URL, route: JobsListRoute): boolean {
  return (
    hasExactStatuses(url, route.statuses) && hasJobsListPageParams(url, route)
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
    create_time: routeMockJobTimestamp,
    execution_start_time: routeMockJobTimestamp,
    execution_end_time: routeMockJobTimestamp + 5_000,
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
      (url) =>
        url.pathname.endsWith('/api/jobs') && matchesJobsListRoute(url, route),
      async (requestRoute) => {
        if (requestRoute.request().method().toUpperCase() !== 'GET') {
          await requestRoute.fallback()
          return
        }

        await requestRoute.fulfill({ json: response })
      }
    )
  }

  async mockClearQueue(): Promise<QueueManageRequest[]> {
    const response = zQueueManageResponse.parse({ cleared: true })
    return await this.mockPostManageRoute(
      'queue',
      zQueueManageRequest,
      response
    )
  }

  async mockClearHistory(): Promise<HistoryManageRequest[]> {
    return await this.mockPostManageRoute('history', zHistoryManageRequest, {})
  }

  async mockDeleteHistory(): Promise<HistoryManageRequest[]> {
    return await this.mockPostManageRoute('history', zHistoryManageRequest, {})
  }

  async mockJobDetail(jobId: string, detail: JobDetail): Promise<void> {
    await this.page.route(
      (url) => url.pathname.endsWith(`/api/jobs/${encodeURIComponent(jobId)}`),
      async (requestRoute) => {
        if (requestRoute.request().method().toUpperCase() !== 'GET') {
          await requestRoute.fallback()
          return
        }

        await requestRoute.fulfill({ json: detail })
      }
    )
  }

  private async mockPostManageRoute<TRequest>(
    type: 'queue' | 'history',
    requestSchema: z.ZodType<TRequest>,
    response: unknown
  ): Promise<TRequest[]> {
    const requests: TRequest[] = []

    await this.page.route(
      (url) => url.pathname.endsWith(`/api/${type}`),
      async (requestRoute) => {
        if (requestRoute.request().method().toUpperCase() !== 'POST') {
          await requestRoute.fallback()
          return
        }

        requests.push(
          requestSchema.parse(requestRoute.request().postDataJSON())
        )
        await requestRoute.fulfill({ json: response })
      }
    )

    return requests
  }
}

export const jobsRouteFixture = base.extend<{
  jobsRoutes: JobsRouteMocker
}>({
  jobsRoutes: async ({ page }, use) => {
    await use(new JobsRouteMocker(page))
  }
})
