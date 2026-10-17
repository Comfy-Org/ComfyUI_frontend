import type { WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = 'b4e7b4e3-8f4c-4c9b-ad2f-7f3b2daf1b23'
const THREAD_ID = 'dac7bad1-ac2b-4cac-9a1f-2b3c4d5e6f81'
const MESSAGE_ID = '1d6c2f88-3e5b-4a0f-9c74-2b3d4e5f6113'
const ADDED_NODE_ID = 9103
const NODE_TEXT = 'the agent says it added this'
const SOCKET_SID = '8e2a3f4b-5c6d-4e7f-9a01-2b3c4d5e6f81'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = {
  nodes: [
    {
      id: ADDED_NODE_ID,
      type: 'MarkdownNote',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: [NODE_TEXT]
    }
  ],
  links: []
}

const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop
const SYNC_FAILED_TITLE = enMessages.agent.workflowSyncFailedTitle
const SYNC_FAILED_DETAIL = enMessages.agent.workflowSyncFailedDetailStaleClient
const COMPOSER_LABEL = /add references, drag in assets/

test.describe(
  'Agent tells the user when the document schema is newer than this build reads',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('a turn the agent reports as done surfaces the incompatible-version notice instead of a silently empty canvas', async ({
      page,
      toast
    }) => {
      test.setTimeout(60_000)
      const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
      const vueNodes = new VueNodeHelpers(page)

      let socket: WebSocketRoute | null = null
      let committedNodeIds: string[] = []

      const send = (frame: AgentWsEvent | HostFrame): void => {
        if (
          (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
          parseServerDocFrame(frame) === null
        )
          throw new Error(`frame ${frame.type} is not a valid doc frame`)
        if (!socket) throw new Error('the app has not opened /ws yet')
        socket.send(JSON.stringify(frame))
      }

      await page.route('**/api/agent/threads', (route) =>
        route.fulfill(jsonRoute({ threads: [] }))
      )
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
              thread_id: THREAD_ID,
              message_id: MESSAGE_ID,
              workflow_id: WORKFLOW_ID
            })
          })
        }
        return route.fulfill(jsonRoute([]))
      })
      await page.routeWebSocket(/\/ws/, (ws) => {
        socket = ws
        ws.send(
          JSON.stringify({
            type: 'status',
            data: {
              status: { exec_info: { queue_remaining: 0 } },
              sid: SOCKET_SID
            }
          })
        )
        ws.onMessage((raw) => {
          const frame: unknown = JSON.parse(raw.toString())
          if (typeof frame !== 'object' || frame === null) return
          const { type, data } = frame as { type?: unknown; data?: unknown }
          if (
            type !== 'doc_subscribe' ||
            typeof data !== 'object' ||
            data === null
          )
            return
          const { workflow_id, state_vector_b64 } = data as {
            workflow_id?: unknown
            state_vector_b64?: unknown
          }
          if (
            workflow_id !== WORKFLOW_ID ||
            typeof state_vector_b64 !== 'string'
          )
            return
          committedNodeIds = Object.keys(host.graph().nodes)
          host.advanceSchemaVersionBeyondReader()
          send(host.subscribed())
          send(host.catchUp(state_vector_b64))
        })
      })

      await bootAgentApp(page, true, {
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        }
      })

      const panel = page.locator('#agent-panel-root')
      const topbarActions = page.getByTestId('integrated-tab-bar-actions')
      await expect(topbarActions).toHaveAttribute(
        'data-agent-gate-settled',
        'true',
        { timeout: 8_000 }
      )
      await new AgentPanel(page).open()
      await expect(panel).toBeVisible({ timeout: 30_000 })

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
        const workflows: WorkflowListResponse = {
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
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        }
        return route.fulfill(jsonRoute(workflows))
      })

      const picker = panel.getByRole('button', {
        name: enMessages.agent.switchWorkflow
      })
      await picker.click()
      await page
        .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
        .click()
      await expect(picker).toHaveText('Unsaved Workflow')

      await expect.poll(() => socket !== null).toBe(true)

      const composer = panel.getByRole('textbox', { name: COMPOSER_LABEL })
      await composer.fill('Rebuild the workflow.')
      await panel.getByRole('button', { name: SEND_LABEL }).click()
      await expect(
        panel.getByText('Rebuild the workflow.').first()
      ).toBeVisible()

      send({
        type: 'agent_active_tab',
        data: {
          workflow_id: WORKFLOW_ID,
          name: 'Unsaved Workflow',
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })
      send({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-1',
          tool_name: 'add_node',
          status: 'success',
          duration_ms: 120,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })

      send({
        type: 'agent_message_delta',
        data: {
          delta: 'Rebuilt the workflow.',
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })
      send({
        type: 'agent_message_done',
        data: { thread_id: THREAD_ID, message_id: MESSAGE_ID, usage: null }
      })

      await expect(
        panel.getByRole('button', { name: SEND_LABEL })
      ).toBeVisible()
      await expect(panel.getByRole('button', { name: STOP_LABEL })).toHaveCount(
        0
      )
      await expect(panel.getByRole('button', { name: /^Worked/ })).toBeVisible()

      await expect
        .poll(() => committedNodeIds, { timeout: 20_000 })
        .toContain(String(ADDED_NODE_ID))

      await expect(toast.withText(SYNC_FAILED_TITLE)).toBeVisible({
        timeout: 15_000
      })
      await expect(toast.withText(SYNC_FAILED_DETAIL)).toBeVisible()

      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toHaveCount(
        0
      )
    })
  }
)
