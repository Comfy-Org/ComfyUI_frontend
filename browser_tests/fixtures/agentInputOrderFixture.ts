import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type {
  AgentRunModePreference,
  AgentTurnAccepted
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import {
  catalog,
  messageId,
  objectInfo,
  seed,
  threadId,
  workflowId
} from '@e2e/fixtures/data/agent/inputOrder'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export const test = agentTest.extend<{
  inputOrderHost: AgentFollowerHostSocket
}>({
  inputOrderHost: async ({ page }, use) => {
    const host = new HostDoc(workflowId, structuredClone(seed), catalog)
    const socket = new AgentFollowerHostSocket(
      page,
      workflowId,
      host,
      '6a80fd06-c647-4b17-9f68-202366e468d8'
    )
    await socket.install()

    const threads: AgentThreadListResponse = {
      pagination: { has_more: false, limit: 100, offset: 0, total: 0 },
      threads: []
    }
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threads))
    )
    const runMode: AgentRunModePreference = {
      mode: 'ask_approval',
      credit_limit: null
    }
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    const accepted: AgentTurnAccepted = {
      thread_id: threadId,
      message_id: messageId,
      workflow_id: workflowId
    }
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST')
        return route.fulfill(jsonRoute([]))
      return route.fulfill({ ...jsonRoute(accepted), status: 202 })
    })

    await bootAgentApp(page, true, {
      objectInfo,
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      }
    })

    let savedName: string | undefined
    await page.route('**/api/userdata/*', (route) => {
      const request = route.request()
      const path = decodeURIComponent(
        new URL(request.url()).pathname.split('/userdata/')[1]
      )
      if (request.method() !== 'POST' || !path.startsWith('workflows/'))
        return route.fallback()
      savedName = path.slice('workflows/'.length, -'.json'.length)
      const saved: UserDataFullInfo = {
        path,
        modified: 1_789_344_000_000,
        size: request.postDataBuffer()?.length ?? 0
      }
      return route.fulfill(jsonRoute(saved))
    })
    await page.route('**/api/workflows?*', (route) => {
      const workflows: WorkflowListResponse = {
        data:
          savedName === undefined
            ? []
            : [
                {
                  id: workflowId,
                  name: savedName,
                  created_at: '2026-09-01T00:00:00Z',
                  updated_at: '2026-09-01T00:00:00Z',
                  created_by: 'test-user-e2e',
                  latest_version: 1
                }
              ],
        pagination: {
          has_more: false,
          limit: 100,
          offset: 0,
          total: savedName === undefined ? 0 : 1
        }
      }
      return route.fulfill(jsonRoute(workflows))
    })

    await use(socket)
  }
})
