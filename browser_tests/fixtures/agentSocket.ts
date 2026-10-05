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
 * The document event the page dispatches, with the raw frame as its detail,
 * once it has handled a frame from the agent socket (see
 * `announceHandledAgentFrames`).
 */
export const AGENT_FRAME_HANDLED_EVENT = 'agent-socket-frame-handled'

/**
 * Makes the page announce every frame its agent socket has handled. A routed
 * socket cannot report delivery, and the panel's own listener is not
 * reachable from a test, so each agent socket the page opens gets a listener
 * of its own. It is registered before the panel's, so it announces on the next
 * task: by then the panel has handled the frame. Install before the page
 * loads.
 */
export async function announceHandledAgentFrames(page: Page): Promise<void> {
  await page.addInitScript(
    ({ urlPattern, eventName }) => {
      const agentSocketUrl = new RegExp(urlPattern)
      class AnnouncingWebSocket extends window.WebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols)
          if (!agentSocketUrl.test(String(url))) return
          this.addEventListener('message', ({ data }) => {
            setTimeout(() =>
              document.dispatchEvent(
                new CustomEvent(eventName, { detail: data })
              )
            )
          })
        }
      }
      window.WebSocket = AnnouncingWebSocket
    },
    {
      urlPattern: AGENT_SOCKET_URL.source,
      eventName: AGENT_FRAME_HANDLED_EVENT
    }
  )
}

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
