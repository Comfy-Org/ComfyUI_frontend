import { test as base, expect } from '@playwright/test'
import type { Page, Route, WebSocketRoute } from '@playwright/test'

import type { LogsRawResponse } from '@/schemas/apiSchema'

const RAW_LOGS_URL = '**/internal/logs/raw**'
const SUBSCRIBE_LOGS_URL = '**/internal/logs/subscribe**'

export class LogsTerminalHelper {
  constructor(private readonly page: Page) {}

  async mockRawLogs(messages: string[]): Promise<() => number> {
    let count = 0
    await this.page.unroute(RAW_LOGS_URL)
    await this.page.route(RAW_LOGS_URL, async (route: Route) => {
      count += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LogsTerminalHelper.buildRawLogsResponse(messages))
      })
    })
    return () => count
  }

  async mockRawLogsPending(messages: string[] = []): Promise<() => void> {
    let resolve!: () => void
    const pending = new Promise<void>((r) => {
      resolve = r
    })
    await this.page.unroute(RAW_LOGS_URL)
    await this.page.route(RAW_LOGS_URL, async (route: Route) => {
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
    await this.page.unroute(RAW_LOGS_URL)
    await this.page.route(RAW_LOGS_URL, (route: Route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    )
  }

  async mockSubscribeLogs(): Promise<() => number> {
    let count = 0
    await this.page.unroute(SUBSCRIBE_LOGS_URL)
    await this.page.route(SUBSCRIBE_LOGS_URL, async (route: Route) => {
      count += 1
      await route.fulfill({ status: 200, body: '' })
    })
    return () => count
  }

  /**
   * Force the frontend to reconnect by closing the proxied WebSocket. The
   * api layer reschedules a fresh `WebSocket(...)`, the routeWebSocket
   * handler fires again, and on `open` with `isReconnect=true` it dispatches
   * `'reconnected'`, which triggers the logs-terminal resync.
   *
   * Use the resync's `subscribeLogs(true)` HTTP call as the sync point — by
   * the time the count goes up, the new socket is open and resync has
   * completed enough to assert against the terminal.
   */
  async triggerReconnect(
    ws: WebSocketRoute,
    subscribeFetches: () => number
  ): Promise<void> {
    const before = subscribeFetches()
    await ws.close()
    await expect.poll(subscribeFetches).toBeGreaterThan(before)
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
