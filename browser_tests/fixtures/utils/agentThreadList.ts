import type { Page } from '@playwright/test'

import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export async function mockEmptyAgentThreadList(page: Page): Promise<void> {
  await page.route('**/api/agent/threads?*', (route) =>
    route.fulfill(jsonRoute(emptyAgentThreadList()))
  )
}
