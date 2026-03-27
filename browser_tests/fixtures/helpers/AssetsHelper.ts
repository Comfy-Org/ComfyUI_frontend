import type { Page, Route } from '@playwright/test'

import type { RawJobListItem } from '../../../src/platform/remote/comfyui/jobs/jobTypes'

const jobsListRoutePattern = /\/api\/jobs(?:\?.*)?$/
const inputFilesRoutePattern = /\/internal\/files\/input(?:\?.*)?$/

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

export class AssetsHelper {
  private jobsRouteHandler: ((route: Route) => Promise<void>) | null = null
  private inputFilesRouteHandler: ((route: Route) => Promise<void>) | null =
    null
  private generatedJobs: RawJobListItem[] = []
  private importedFiles: string[] = []

  constructor(private readonly page: Page) {}

  async mockOutputHistory(jobs: RawJobListItem[]): Promise<void> {
    this.generatedJobs = [...jobs]

    if (this.jobsRouteHandler) {
      return
    }

    this.jobsRouteHandler = async (route: Route) => {
      const url = new URL(route.request().url())
      const statuses = url.searchParams
        .get('status')
        ?.split(',')
        .map((status) => status.trim())
        .filter(Boolean)
      const workflowId = url.searchParams.get('workflow_id')
      const sortBy = url.searchParams.get('sort_by')
      const sortOrder = url.searchParams.get('sort_order') === 'asc' ? 1 : -1

      let filteredJobs = [...this.generatedJobs]

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

    await this.page.route(jobsListRoutePattern, this.jobsRouteHandler)
  }

  async mockInputFiles(files: string[]): Promise<void> {
    this.importedFiles = [...files]

    if (this.inputFilesRouteHandler) {
      return
    }

    this.inputFilesRouteHandler = async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.importedFiles)
      })
    }

    await this.page.route(inputFilesRoutePattern, this.inputFilesRouteHandler)
  }

  async mockEmptyState(): Promise<void> {
    await this.mockOutputHistory([])
    await this.mockInputFiles([])
  }

  async clearMocks(): Promise<void> {
    this.generatedJobs = []
    this.importedFiles = []

    if (this.jobsRouteHandler) {
      await this.page.unroute(jobsListRoutePattern, this.jobsRouteHandler)
      this.jobsRouteHandler = null
    }

    if (this.inputFilesRouteHandler) {
      await this.page.unroute(
        inputFilesRoutePattern,
        this.inputFilesRouteHandler
      )
      this.inputFilesRouteHandler = null
    }
  }
}
