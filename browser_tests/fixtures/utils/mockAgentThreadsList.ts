import type { Page } from '@playwright/test'

import type { AgentThreadListResponse } from '@comfyorg/ingest-types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/** Mocks the agent panel's own thread list as always empty. */
export async function mockEmptyAgentThreadsList(page: Page): Promise<void> {
  const empty: AgentThreadListResponse = {
    threads: [],
    pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
  }
  await page.route('**/api/agent/threads', (route) =>
    route.fulfill(jsonRoute(empty))
  )
}
