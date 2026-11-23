import type { AgentIdentity } from '@comfyorg/ingest-types'
import type { Page } from '@playwright/test'

import { WEB_SESSION } from '@e2e/fixtures/data/webSession'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export const AGENT_SOCKET_URL = /\/api\/agent\/events(?:\?|$)/

export const AGENT_FRAME_HANDLED_EVENT = 'agent-socket-frame-handled'

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

export async function mockAgentIdentity(
  page: Page,
  userId = WEB_SESSION.user.id
): Promise<void> {
  const identity: AgentIdentity = {
    workspace_id: 'ws-personal',
    user_id: userId
  }
  await page.route('**/api/agent/identity', (route) =>
    route.fulfill(jsonRoute(identity))
  )
}
