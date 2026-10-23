import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = 'b4e7b4e3-8f4c-4c9b-ad2f-7f3b2daf1b23'
const THREAD_ID = 'dac7bad1-ac2b-4cac-9a1f-2b3c4d5e6f81'
const MESSAGE_ID = '1d6c2f88-3e5b-4a0f-9c74-2b3d4e5f6113'
const ADDED_NODE_ID = 9103
const NODE_TEXT = 'the agent says it added this'

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

      let committedNodeIds: string[] = []

      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
      hostSocket.answerSubscribesWith((stateVector) => {
        committedNodeIds = Object.keys(host.graph().nodes)
        host.advanceSchemaVersionBeyondReader()
        return [host.subscribed(), host.catchUp(stateVector)]
      })

      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(emptyAgentThreadList()))
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
      await hostSocket.install()

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
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
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

      await expect.poll(() => hostSocket.connectionCount()).toBeGreaterThan(0)

      const composer = agentPanel.composer
      await composer.fill('Rebuild the workflow.')
      await panel.getByRole('button', { name: SEND_LABEL }).click()
      await expect(
        panel.getByText('Rebuild the workflow.').first()
      ).toBeVisible()

      hostSocket.send({
        type: 'agent_active_tab',
        data: {
          workflow_id: WORKFLOW_ID,
          name: 'Unsaved Workflow',
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })
      hostSocket.send({
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

      hostSocket.send({
        type: 'agent_message_delta',
        data: {
          delta: 'Rebuilt the workflow.',
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })
      hostSocket.send({
        type: 'agent_message_done',
        data: { thread_id: THREAD_ID, message_id: MESSAGE_ID, usage: null }
      })

      await expect(
        panel.getByRole('button', { name: SEND_LABEL })
      ).toBeVisible()
      await expect(panel.getByRole('button', { name: STOP_LABEL })).toHaveCount(
        0
      )
      await expect(
        panel.getByRole('button', {
          name: enMessages.agent.workedNotConfirmedOnCanvas,
          exact: true
        })
      ).toBeVisible()

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
