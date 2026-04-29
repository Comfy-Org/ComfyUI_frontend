import type { Page, Route } from '@playwright/test'
import type {
  JobDetailResponse,
  JobEntry,
  JobsListResponse
} from '@comfyorg/ingest-types'

const jobsListRoutePattern = /\/api\/jobs(?:\?.*)?$/
const jobDetailRoutePattern = /\/api\/jobs\/[^/?#]+(?:\?.*)?$/
const historyRoutePattern = /\/api\/history(?:\?.*)?$/

export type MockJobRecord = {
  listItem: JobEntry
  detail: JobDetailResponse
}

type JobsListMockResponse = Omit<JobsListResponse, 'pagination'> & {
  pagination: Omit<JobsListResponse['pagination'], 'limit'> & {
    limit: number | null
  }
}

function parsePositiveIntegerParam(url: URL, name: string): number | undefined {
  const value = Number(url.searchParams.get(name))

  return Number.isInteger(value) && value > 0 ? value : undefined
}

function getJobIdFromRequest(route: Route): string | null {
  const url = new URL(route.request().url())
  const jobId = url.pathname.split('/').at(-1)

  return jobId ? decodeURIComponent(jobId) : null
}

export class JobsApiMock {
  private listRouteHandler: ((route: Route) => Promise<void>) | null = null
  private detailRouteHandler: ((route: Route) => Promise<void>) | null = null
  private historyRouteHandler: ((route: Route) => Promise<void>) | null = null
  private jobsById = new Map<string, MockJobRecord>()

  constructor(private readonly page: Page) {}

  async mockJobs(jobs: MockJobRecord[]): Promise<void> {
    this.jobsById = new Map(
      jobs.map(
        (job) => [job.listItem.id, job] satisfies [string, MockJobRecord]
      )
    )
    await this.ensureRoutesRegistered()
  }

  async clear(): Promise<void> {
    this.jobsById.clear()

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

        let filteredJobs = Array.from(
          this.jobsById.values(),
          ({ listItem }) => listItem
        )

        if (statuses?.length) {
          filteredJobs = filteredJobs.filter((job) =>
            statuses.includes(job.status)
          )
        }

        const offset = parsePositiveIntegerParam(url, 'offset') ?? 0
        const limit = parsePositiveIntegerParam(url, 'limit')
        const total = filteredJobs.length
        const visibleJobs =
          limit === undefined
            ? filteredJobs.slice(offset)
            : filteredJobs.slice(offset, offset + limit)

        const response = {
          jobs: visibleJobs,
          pagination: {
            offset,
            limit: limit ?? null,
            total,
            has_more: offset + visibleJobs.length < total
          }
        } satisfies JobsListMockResponse

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
        const job = jobId ? this.jobsById.get(jobId) : undefined

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
        const request = route.request()
        if (request.method() !== 'POST') {
          await route.continue()
          return
        }

        const requestBody = request.postDataJSON() as
          | { delete?: string[]; clear?: boolean }
          | undefined

        if (requestBody?.clear) {
          this.jobsById = new Map(
            Array.from(this.jobsById).filter(([, job]) => {
              const status = job.listItem.status

              return status === 'pending' || status === 'in_progress'
            })
          )
        }

        if (requestBody?.delete?.length) {
          for (const jobId of requestBody.delete) {
            this.jobsById.delete(jobId)
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
