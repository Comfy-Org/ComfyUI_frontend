import type { Page, Route } from '@playwright/test'

import type {
  JobDetail,
  RawJobListItem
} from '../../../src/platform/remote/comfyui/jobs/jobTypes'

const jobsListRoutePattern = /\/api\/jobs(?:\?.*)?$/
const jobDetailRoutePattern = /\/api\/jobs\/[^/?#]+(?:\?.*)?$/
const historyRoutePattern = /\/api\/history(?:\?.*)?$/

export type SeededJob = {
  listItem: RawJobListItem
  detail: JobDetail
}

function parseLimit(url: URL, total: number): number {
  const value = Number(url.searchParams.get('limit'))
  if (!Number.isInteger(value) || value <= 0) {
    return total
  }
  return value
}

function parseOffset(url: URL): number {
  const value = Number(url.searchParams.get('offset'))
  if (!Number.isInteger(value) || value < 0) {
    return 0
  }
  return value
}

function getExecutionDuration(job: RawJobListItem): number {
  const start = job.execution_start_time ?? 0
  const end = job.execution_end_time ?? 0
  return end - start
}

export class JobsApiMock {
  private listRouteHandler: ((route: Route) => Promise<void>) | null = null
  private detailRouteHandler: ((route: Route) => Promise<void>) | null = null
  private historyRouteHandler: ((route: Route) => Promise<void>) | null = null
  private seededJobs: SeededJob[] = []

  constructor(private readonly page: Page) {}

  async seedJobs(jobs: SeededJob[]): Promise<void> {
    this.seededJobs = [...jobs]
    await this.ensureRoutesRegistered()
  }

  async clearMocks(): Promise<void> {
    this.seededJobs = []

    if (this.listRouteHandler) {
      await this.page.unroute(jobsListRoutePattern, this.listRouteHandler)
      this.listRouteHandler = null
    }

    if (this.detailRouteHandler) {
      await this.page.unroute(jobDetailRoutePattern, this.detailRouteHandler)
      this.detailRouteHandler = null
    }

    if (this.historyRouteHandler) {
      await this.page.unroute(historyRoutePattern, this.historyRouteHandler)
      this.historyRouteHandler = null
    }
  }

  private async ensureRoutesRegistered(): Promise<void> {
    if (!this.listRouteHandler) {
      this.listRouteHandler = async (route: Route) => {
        const url = new URL(route.request().url())
        const statuses = url.searchParams
          .get('status')
          ?.split(',')
          .map((status) => status.trim())
          .filter(Boolean)
        const workflowId = url.searchParams.get('workflow_id')
        const sortBy = url.searchParams.get('sort_by')
        const sortOrder = url.searchParams.get('sort_order') === 'asc' ? 1 : -1

        let filteredJobs = this.seededJobs.map(({ listItem }) => listItem)

        if (statuses?.length) {
          filteredJobs = filteredJobs.filter((job) =>
            statuses.includes(job.status)
          )
        }

        if (workflowId) {
          filteredJobs = filteredJobs.filter(
            (job) => job.workflow_id === workflowId
          )
        }

        filteredJobs.sort((left, right) => {
          const leftValue =
            sortBy === 'execution_duration'
              ? getExecutionDuration(left)
              : left.create_time
          const rightValue =
            sortBy === 'execution_duration'
              ? getExecutionDuration(right)
              : right.create_time

          return (leftValue - rightValue) * sortOrder
        })

        const offset = parseOffset(url)
        const total = filteredJobs.length
        const limit = parseLimit(url, total)
        const visibleJobs = filteredJobs.slice(offset, offset + limit)

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jobs: visibleJobs,
            pagination: {
              offset,
              limit,
              total,
              has_more: offset + visibleJobs.length < total
            }
          })
        })
      }

      await this.page.route(jobsListRoutePattern, this.listRouteHandler)
    }

    if (!this.detailRouteHandler) {
      this.detailRouteHandler = async (route: Route) => {
        const jobId = route
          .request()
          .url()
          .split('/api/jobs/')[1]
          ?.split('?')[0]
        const job = jobId
          ? this.seededJobs.find(({ listItem }) => listItem.id === jobId)
          : undefined

        if (!job) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Job not found' })
          })
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(job.detail)
        })
      }

      await this.page.route(jobDetailRoutePattern, this.detailRouteHandler)
    }

    if (!this.historyRouteHandler) {
      this.historyRouteHandler = async (route: Route) => {
        const requestBody = route.request().postDataJSON() as
          | { delete?: string[]; clear?: boolean }
          | undefined

        if (requestBody?.clear) {
          this.seededJobs = this.seededJobs.filter(
            ({ listItem }) =>
              listItem.status === 'pending' || listItem.status === 'in_progress'
          )
        }

        if (requestBody?.delete?.length) {
          const deletedIds = new Set(requestBody.delete)
          this.seededJobs = this.seededJobs.filter(
            ({ listItem }) => !deletedIds.has(listItem.id)
          )
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({})
        })
      }

      await this.page.route(historyRoutePattern, this.historyRouteHandler)
    }
  }
}
