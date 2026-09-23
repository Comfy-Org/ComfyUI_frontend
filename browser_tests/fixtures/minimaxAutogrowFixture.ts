import { expect } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'
import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/schemas/apiSchema'
import type {
  AgentMessages,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { isValidDocOpsBatch, parseWireOps } from '@e2e/fixtures/agentWireFrame'
import {
  referenceCatalog,
  referenceGraphOps,
  referenceNodeDefs,
  referenceSeed
} from '@e2e/fixtures/data/minimaxAutogrowReload'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = '2f1a9b4e-3c7d-4e9a-9a1e-1c2d3e4f5a6b'
const THREAD_ID = 'b1c9a7d2-5e4f-4a3b-9c1d-6e7f8a9b0c1d'
const MESSAGE_ID = 'd4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f7a'

export const minimaxAutogrowTest = agentTest.extend<{
  referenceAgent: { materialize(): Promise<void> }
}>({
  referenceAgent: async ({ page, agentFlagEnabled }, use) => {
    const host = new HostDoc(WORKFLOW_ID, referenceSeed, referenceCatalog)
    let connection: WebSocketRoute | undefined
    let subscribed = false
    await page.routeWebSocket(/\/ws/, (socket) => {
      connection = socket
      socket.onMessage((raw) => {
        const frame: unknown = JSON.parse(raw.toString())
        if (typeof frame !== 'object' || frame === null || !('data' in frame))
          return
        const { data } = frame
        if (
          typeof data !== 'object' ||
          data === null ||
          !('workflow_id' in data) ||
          data.workflow_id !== WORKFLOW_ID ||
          !('type' in frame)
        )
          return
        if (
          frame.type === 'doc_subscribe' &&
          'state_vector_b64' in data &&
          typeof data.state_vector_b64 === 'string'
        ) {
          socket.send(JSON.stringify(host.subscribed()))
          socket.send(JSON.stringify(host.catchUp(data.state_vector_b64)))
          subscribed = true
        } else if (frame.type === 'doc_ops' && 'ops' in data) {
          const parsed = parseWireOps(data.ops)
          if (!parsed.ok || !isValidDocOpsBatch(parsed.ops))
            throw new Error('Invalid client doc_ops batch')
          const { result, update } = host.applyWire(parsed.ops)
          socket.send(JSON.stringify(result))
          if (update) socket.send(JSON.stringify(update))
        }
      })
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid: 'minimax-autogrow'
          }
        })
      )
    })
    await page.route('**/api/agent/threads', (route) => {
      const response: AgentThreadListResponse = {
        threads: [],
        pagination: { offset: 0, limit: 100, total: 0, has_more: false }
      }
      return route.fulfill(jsonRoute(response))
    })
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST') {
        const messages: AgentMessages = []
        return route.fulfill(jsonRoute(messages))
      }
      const accepted: AgentTurnAccepted = {
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      }
      return route.fulfill({ ...jsonRoute(accepted), status: 202 })
    })
    await bootAgentApp(page, agentFlagEnabled, {
      objectInfo: referenceNodeDefs,
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
        modified: Date.now(),
        size: request.postDataBuffer()?.length ?? 0
      }
      return route.fulfill(jsonRoute(saved))
    })
    await page.route('**/api/workflows?*', (route) => {
      const response: WorkflowListResponse = {
        data:
          savedName === undefined
            ? []
            : [
                {
                  id: WORKFLOW_ID,
                  name: savedName,
                  created_at: '2026-09-01T00:00:00Z',
                  updated_at: '2026-09-01T00:00:00Z',
                  created_by: 'test-user-e2e',
                  latest_version: 1
                }
              ],
        pagination: {
          offset: 0,
          limit: 100,
          total: savedName === undefined ? 0 : 1,
          has_more: false
        }
      }
      return route.fulfill(jsonRoute(response))
    })

    await page
      .getByRole('button', {
        name: enMessages.agent.askComfyAgent,
        exact: true
      })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('Build a reference video workflow')
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => subscribed).toBe(true)
    const done: AgentWsEvent = {
      type: 'agent_message_done',
      data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
    }
    connection!.send(JSON.stringify(done))
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop, exact: true })
    ).toHaveCount(0)

    await use({
      async materialize() {
        connection!.send(JSON.stringify(host.apply(referenceGraphOps)))
        const ids = referenceGraphOps.flatMap((op) =>
          op.op === 'add_node' ? [String(op.node_id)] : []
        )
        await expect
          .poll(() =>
            page.evaluate((expectedIds) => {
              const live = new Set(
                window.app!.graph.nodes.map(({ id }) => String(id))
              )
              return expectedIds.filter((id) => !live.has(id))
            }, ids)
          )
          .toEqual([])
      }
    })
  }
})
