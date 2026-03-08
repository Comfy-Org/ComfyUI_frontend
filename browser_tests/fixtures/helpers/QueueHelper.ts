import type { Page } from '@playwright/test'

export class QueueHelper {
  constructor(private readonly page: Page) {}

  /**
   * Mock the /api/queue endpoint to return specific queue state.
   */
  async mockQueueState(
    running: number = 0,
    pending: number = 0
  ): Promise<void> {
    await this.page.route('**/api/queue', (route) =>
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
    )
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
          completed: job.status === 'success'
        }
      }
    }
    await this.page.route('**/api/history**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(history)
      })
    )
  }

  /**
   * Clear all route mocks set by this helper.
   */
  async clearMocks(): Promise<void> {
    await this.page.unroute('**/api/queue')
    await this.page.unroute('**/api/history**')
  }
}
