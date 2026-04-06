import type { Page, Route } from '@playwright/test'
import type {
  JobDetailResponse,
  JobEntry,
  JobsListResponse
} from '@comfyorg/ingest-types'

const jobsListRoutePattern = /\/api\/jobs(?:\?.*)?$/
const jobDetailRoutePattern = /\/api\/jobs\/[^/?#]+(?:\?.*)?$/
const historyRoutePattern = /\/api\/history(?:\?.*)?$/

export type SeededJob = {
  listItem: JobEntry
  detail: JobDetailResponse
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

function getExecutionDuration(job: JobEntry): number {
  const start = job.execution_start_time ?? 0
  const end = job.execution_end_time ?? 0

  return end - start
}

function getJobIdFromRequest(route: Route): string | null {
  const url = new URL(route.request().url())
  const jobId = url.pathname.split('/').at(-1)

  return jobId ? decodeURIComponent(jobId) : null
}

export class InMemoryJobsBackend {
  private listRouteHandler: ((route: Route) => Promise<void>) | null = null
  private detailRouteHandler: ((route: Route) => Promise<void>) | null = null
  private historyRouteHandler: ((route: Route) => Promise<void>) | null = null
  private seededJobs = new Map<string, SeededJob>()

  constructor(private readonly page: Page) {}

  async seed(jobs: SeededJob[]): Promise<void> {
    this.seededJobs = new Map(
      jobs.map((job) => [job.listItem.id, job] satisfies [string, SeededJob])
    )
    await this.ensureRoutesRegistered()
  }

  async clear(): Promise<void> {
    this.seededJobs.clear()

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

        let filteredJobs = Array.from(
          this.seededJobs.values(),
          ({ listItem }) => listItem
        )

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

        const response = {
          jobs: visibleJobs,
          pagination: {
            offset,
            limit,
            total,
            has_more: offset + visibleJobs.length < total
          }
        } satisfies JobsListResponse

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      }

      await this.page.route(jobsListRoutePattern, this.listRouteHandler)
    }

    if (!this.detailRouteHandler) {
      this.detailRouteHandler = async (route: Route) => {
        const jobId = getJobIdFromRequest(route)
        const job = jobId ? this.seededJobs.get(jobId) : undefined

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
          this.seededJobs = new Map(
            Array.from(this.seededJobs).filter(([, job]) => {
              const status = job.listItem.status

              return status === 'pending' || status === 'in_progress'
            })
          )
        }

        if (requestBody?.delete?.length) {
          for (const jobId of requestBody.delete) {
            this.seededJobs.delete(jobId)
          }
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
