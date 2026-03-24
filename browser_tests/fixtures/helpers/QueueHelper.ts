import type { Page, Route } from '@playwright/test'

export class QueueHelper {
  private queueRouteHandler: ((route: Route) => void) | null = null
  private historyRouteHandler: ((route: Route) => void) | null = null
  private jobsRouteHandler: ((route: Route) => void) | null = null
  private queueJobs: Array<Record<string, unknown>> = []
  private historyJobs: Array<Record<string, unknown>> = []

  constructor(private readonly page: Page) {}

  /**
   * Mock the /api/queue endpoint to return specific queue state.
   */
  async mockQueueState(
    running: number = 0,
    pending: number = 0
  ): Promise<void> {
    const baseTime = Date.now()
    this.queueJobs = [
      ...Array.from({ length: running }, (_, i) => ({
        id: `running-${i}`,
        status: 'in_progress',
        create_time: baseTime - i * 1000,
        execution_start_time: baseTime - 5000 - i * 1000,
        execution_end_time: null,
        priority: i + 1
      })),
      ...Array.from({ length: pending }, (_, i) => ({
        id: `pending-${i}`,
        status: 'pending',
        create_time: baseTime - (running + i) * 1000,
        execution_start_time: null,
        execution_end_time: null,
        priority: running + i + 1
      }))
    ]

    this.queueRouteHandler = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          queue_running: Array.from({ length: running }, (_, i) => [
            i,
            `running-${i}`,
            {},
            {},
            []
          ]),
          queue_pending: Array.from({ length: pending }, (_, i) => [
            i,
            `pending-${i}`,
            {},
            {},
            []
          ])
        })
      })
    await this.page.route('**/api/queue', this.queueRouteHandler)
    await this.installJobsRoute()
  }

  /**
   * Mock the /api/history endpoint with completed/failed job entries.
   */
  async mockHistory(
    jobs: Array<{ promptId: string; status: 'success' | 'error' }>
  ): Promise<void> {
    const baseTime = Date.now()
    this.historyJobs = jobs.map((job, index) => {
      const completed = job.status === 'success'

      return {
        id: job.promptId,
        status: completed ? 'completed' : 'failed',
        create_time: baseTime - index * 1000,
        execution_start_time: baseTime - 5000 - index * 1000,
        execution_end_time: baseTime - index * 1000,
        outputs_count: completed ? 1 : 0,
        workflow_id: `workflow-${job.promptId}`,
        preview_output: completed
          ? {
              filename: `${job.promptId}.png`,
              subfolder: '',
              type: 'output',
              nodeId: '1',
              mediaType: 'images'
            }
          : null
      }
    })

    const history: Record<string, unknown> = {}
    for (const job of jobs) {
      history[job.promptId] = {
        prompt: [0, job.promptId, {}, {}, []],
        outputs: {},
        status: {
          status_str: job.status === 'success' ? 'success' : 'error',
          completed: true
        }
      }
    }
    this.historyRouteHandler = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(history)
      })
    await this.page.route('**/api/history**', this.historyRouteHandler)
    await this.installJobsRoute()
  }

  private async installJobsRoute() {
    if (this.jobsRouteHandler) {
      return
    }

    this.jobsRouteHandler = (route: Route) => {
      const url = new URL(route.request().url())
      const statuses =
        url.searchParams
          .get('status')
          ?.split(',')
          .filter((status) => status.length > 0) ?? []
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 200)
      const jobs = [...this.queueJobs, ...this.historyJobs].filter(
        (job) => statuses.length === 0 || statuses.includes(String(job.status))
      )
      const paginatedJobs = jobs.slice(offset, offset + limit)

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: paginatedJobs,
          pagination: {
            offset,
            limit,
            total: jobs.length,
            has_more: offset + paginatedJobs.length < jobs.length
          }
        })
      })
    }

    await this.page.route('**/api/jobs**', this.jobsRouteHandler)
  }

  /**
   * Clear all route mocks set by this helper.
   */
  async clearMocks(): Promise<void> {
    if (this.queueRouteHandler) {
      await this.page.unroute('**/api/queue', this.queueRouteHandler)
      this.queueRouteHandler = null
    }
    if (this.historyRouteHandler) {
      await this.page.unroute('**/api/history**', this.historyRouteHandler)
      this.historyRouteHandler = null
    }
    if (this.jobsRouteHandler) {
      await this.page.unroute('**/api/jobs**', this.jobsRouteHandler)
      this.jobsRouteHandler = null
    }
  }
}
