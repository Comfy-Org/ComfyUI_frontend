import type { Page } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/** Mocks the agent panel's own thread list as always empty. */
export async function mockEmptyAgentThreadsList(page: Page): Promise<void> {
  await page.route('**/api/agent/threads', (route) =>
    route.fulfill(jsonRoute({ threads: [] }))
  )
}
