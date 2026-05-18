import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type { LogsRawResponse } from '@/schemas/apiSchema'

export class LogsTerminalHelper {
  constructor(private readonly page: Page) {}

  async mockRawLogs(messages: string[]) {
    await this.page.route('**/internal/logs/raw**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LogsTerminalHelper.buildRawLogsResponse(messages))
      })
    )
  }

  async mockRawLogsPending(messages: string[] = []): Promise<() => void> {
    let resolve!: () => void
    const pending = new Promise<void>((r) => {
      resolve = r
    })
    await this.page.route('**/internal/logs/raw**', async (route: Route) => {
      await pending
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LogsTerminalHelper.buildRawLogsResponse(messages))
      })
    })
    return resolve
  }

  async mockRawLogsError() {
    await this.page.route('**/internal/logs/raw**', (route: Route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    )
  }

  async mockSubscribeLogs() {
    await this.page.route('**/internal/logs/subscribe**', (route: Route) =>
      route.fulfill({ status: 200, body: '' })
    )
  }

  static buildWsLogFrame(messages: string[]): string {
    return JSON.stringify({
      type: 'logs',
      data: { entries: LogsTerminalHelper.buildEntries(messages) }
    })
  }

  private static buildRawLogsResponse(messages: string[]): LogsRawResponse {
    return {
      size: { cols: 80, row: 24 },
      entries: LogsTerminalHelper.buildEntries(messages)
    }
  }

  private static buildEntries(messages: string[]) {
    return messages.map((m) => ({
      t: '1970-01-01T00:00:00.000Z',
      m: m.endsWith('\n') ? m : `${m}\n`
    }))
  }
}

export const logsTerminalFixture = base.extend<{
  logsTerminal: LogsTerminalHelper
}>({
  logsTerminal: async ({ page }, use) => {
    await use(new LogsTerminalHelper(page))
  }
})
