import type { Page, Route } from '@playwright/test'

export class QueueHelper {
  private queueRouteHandler: ((route: Route) => void) | null = null
  private historyRouteHandler: ((route: Route) => void) | null = null

  constructor(private readonly page: Page) {}

  /**
   * Mock the /api/queue endpoint to return specific queue state.
   */
  async mockQueueState(
    running: number = 0,
    pending: number = 0
  ): Promise<void> {
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
  }

  /**
   * Mock the /api/history endpoint with completed/failed job entries.
   */
  async mockHistory(
    jobs: Array<{ promptId: string; status: 'success' | 'error' }>
  ): Promise<void> {
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
  }
}
