import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type { LogsRawResponse } from '@/schemas/apiSchema'

import type { BottomPanel } from '@e2e/fixtures/components/BottomPanel'

export class LogsTerminalHelper {
  constructor(
    private readonly page: Page,
    readonly bottomPanel: BottomPanel
  ) {}

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

  async openLogsTab() {
    await this.bottomPanel.openLogsTab()
  }

  static buildWsLogFrame(messages: string[]): string {
    return JSON.stringify({
      type: 'logs',
      data: {
        entries: messages.map((m) => ({ t: new Date().toISOString(), m }))
      }
    })
  }

  private static buildRawLogsResponse(messages: string[]): LogsRawResponse {
    return {
      size: { cols: 80, row: 24 },
      entries: messages.map((m) => ({ t: new Date().toISOString(), m }))
    }
  }
}

export const logsTerminalFixture = base.extend<{
  logsTerminal: LogsTerminalHelper
}>({
  logsTerminal: async ({ page, context: _ }, use) => {
    // BottomPanel is instantiated fresh here; the fixture is self-contained.
    // We import lazily to avoid a circular dep on ComfyPage.
    const { BottomPanel } = await import('@e2e/fixtures/components/BottomPanel')
    const helper = new LogsTerminalHelper(page, new BottomPanel(page))
    await use(helper)
  }
})
