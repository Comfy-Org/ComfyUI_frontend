import type { Page, Route } from '@playwright/test'
import type { JobsListResponse } from '@comfyorg/ingest-types'

import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

const jobsListRoutePattern = /\/api\/jobs(?:\?.*)?$/
const inputFilesRoutePattern = /\/internal\/files\/input(?:\?.*)?$/
const historyRoutePattern = /\/api\/history$/

/** Factory to create a mock completed job with preview output. */
export function createMockJob(
  overrides: Partial<RawJobListItem> & { id: string }
): RawJobListItem {
  const now = Date.now()
  return {
    status: 'completed',
    create_time: now,
    execution_start_time: now,
    execution_end_time: now + 5000,
    preview_output: {
      filename: `output_${overrides.id}.png`,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1,
    priority: 0,
    ...overrides
  }
}

/** Create multiple mock jobs with sequential IDs and staggered timestamps. */
export function createMockJobs(
  count: number,
  baseOverrides?: Partial<RawJobListItem>
): RawJobListItem[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) =>
    createMockJob({
      id: `job-${String(i + 1).padStart(3, '0')}`,
      create_time: now - i * 60_000,
      execution_start_time: now - i * 60_000,
      execution_end_time: now - i * 60_000 + 5000 + i * 1000,
      preview_output: {
        filename: `image_${String(i + 1).padStart(3, '0')}.png`,
        subfolder: '',
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      },
      ...baseOverrides
    })
  )
}

/** Create mock imported file names with various media types. */
export function createMockImportedFiles(count: number): string[] {
  const extensions = ['png', 'jpg', 'mp4', 'wav', 'glb', 'txt']
  return Array.from(
    { length: count },
    (_, i) =>
      `imported_${String(i + 1).padStart(3, '0')}.${extensions[i % extensions.length]}`
  )
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

export class AssetsHelper {
  private jobsRouteHandler: ((route: Route) => Promise<void>) | null = null
  private inputFilesRouteHandler: ((route: Route) => Promise<void>) | null =
    null
  private deleteHistoryRouteHandler: ((route: Route) => Promise<void>) | null =
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

      const response = {
        jobs: visibleJobs,
        pagination: {
          offset,
          limit,
          total,
          has_more: offset + visibleJobs.length < total
        }
      } satisfies {
        jobs: unknown[]
        pagination: JobsListResponse['pagination']
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
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

  /**
   * Mock the POST /api/history endpoint used for deleting history items.
   * On receiving a `{ delete: [id] }` payload, removes matching jobs from
   * the in-memory mock state so subsequent /api/jobs fetches reflect the
   * deletion.
   */
  async mockDeleteHistory(): Promise<void> {
    if (this.deleteHistoryRouteHandler) return

    this.deleteHistoryRouteHandler = async (route: Route) => {
      const request = route.request()
      if (request.method() !== 'POST') {
        await route.continue()
        return
      }

      const body = request.postDataJSON() as { delete?: string[] }
      if (body.delete) {
        const idsToRemove = new Set(body.delete)
        this.generatedJobs = this.generatedJobs.filter(
          (job) => !idsToRemove.has(job.id)
        )
      }

      await route.fulfill({ status: 200, body: '{}' })
    }

    await this.page.route(historyRoutePattern, this.deleteHistoryRouteHandler)
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

    if (this.deleteHistoryRouteHandler) {
      await this.page.unroute(
        historyRoutePattern,
        this.deleteHistoryRouteHandler
      )
      this.deleteHistoryRouteHandler = null
    }
  }
}
