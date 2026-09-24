import type { Page } from '@playwright/test'
import type { z } from 'zod'

import type { zAgentIdentityWire } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * The agent panel's ONE socket, `/api/agent/events` (see agentEventSource).
 * Every agent_* event and every doc_* / awareness frame rides it in both
 * directions; ComfyUI's `/ws` carries none of them. It has no ComfyUI
 * `status` frame either: the follower resubscribes on every socket open.
 */
export const AGENT_SOCKET_URL = /\/api\/agent\/events(?:\?|$)/

/**
 * The user id `GET /api/agent/identity` reports. The follower stamps every
 * human op with `human:<user_id>:<tab>`, so it matches the signed-in cloud
 * test user the boot mocks authenticate as.
 */
const AGENT_USER_ID = 'test-user-e2e'

type AgentIdentityWire = z.infer<typeof zAgentIdentityWire>

/**
 * Answers the identity lookup the canvas follower waits on; until it answers
 * the follower stays inactive and never sends `doc_subscribe`.
 */
export async function mockAgentIdentity(
  page: Page,
  userId: string = AGENT_USER_ID
): Promise<void> {
  const identity: AgentIdentityWire = {
    workspace_id: 'ws-personal',
    user_id: userId
  }
  await page.route('**/api/agent/identity', (route) =>
    route.fulfill(jsonRoute(identity))
  )
}
