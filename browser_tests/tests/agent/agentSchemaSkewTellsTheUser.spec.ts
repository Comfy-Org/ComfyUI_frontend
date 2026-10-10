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

/**
 * Regression test for PM-2047 (recurrence of PM-2046): "Agent rebuild never
 * shows the workflow — complete failure to initialize workflow, survives
 * refresh, re-login and restarts."
 *
 * This is the sibling of `agentZeroNodesOnUnreadableSchema.spec.ts`, and it
 * covers the half that one explicitly does not. That spec simulates an
 * ABSENT `meta.schema_version` and proves the gate un-latches when the host
 * sends a repair frame; its own header records that the real-world trigger
 * for an absent version was never found.
 *
 * The real-world trigger is a version SKEW, not an absent version. The gate
 * (`assertReadableSchema`, KA-11) is exact-equality against the version this
 * build compiled against, so a doc-host writing `SCHEMA_VERSION + 1` makes
 * every frame of every document unreadable to the served frontend. There is
 * no repair frame in that world — the writer is not wrong, the two sides are
 * pinned to different releases — so the un-latching fix cannot help, and the
 * refusal is permanent by construction.
 *
 * What made it "complete failure to initialize": both operands of that
 * comparison are the document's stored version and the frontend bundle's
 * compiled constant. A refresh, a logout/login, a browser restart and a
 * reboot all change neither, so every recovery path the person has re-runs
 * the identical comparison and gets the identical refusal — while the agent's
 * turn completes and reports success over the unrelated chat channel.
 *
 * The gate is NOT relaxed here: projecting a document this build cannot read
 * is the fail-open failure KA-11 exists to prevent. What this asserts is that
 * the person is TOLD. Before the fix the read gate reported only to the dev
 * panel and an `errored` counter — it was the one refusal that blanks the
 * whole canvas and the only one with no user-visible signal at all.
 */

const WORKFLOW_ID = 'b4e7b4e3-8f4c-4c9b-ad2f-7f3b2daf1b23'
const THREAD_ID = 'dac7bad1-ac2b-4cac-9a1f-2b3c4d5e6f81'
const MESSAGE_ID = '1d6c2f88-3e5b-4a0f-9c74-2b3d4e5f6113'
const ADDED_NODE_ID = 9103
const NODE_TEXT = 'the agent says it added this'
const SOCKET_SID = '8e2a3f4b-5c6d-4e7f-9a01-2b3c4d5e6f81'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
/**
 * PM-2047's reporter asked the agent to rebuild the workflow in earlier turns,
 * so the stored document already holds the rebuilt graph before this session
 * ever subscribes. Seeding it at mint keeps the host's own seq bookkeeping
 * untouched, so the only thing this spec varies is the schema stamp.
 */
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
const SYNC_FAILED_DETAIL = enMessages.agent.workflowSyncFailedDetail
/**
 * Matched on the invariant tail of `agent.placeholder` rather than the whole
 * string: the "/ use skills," clause is feature-gated, so the full localized
 * message is not always the composer's accessible name.
 */
const COMPOSER_LABEL = /add references, drag in assets/

test.describe(
  'Agent tells the user when the document schema is newer than this build reads',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('a turn the agent reports as done surfaces the incompatible-version notice instead of a silently empty canvas', async ({
      page
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
          // Captured while the host can still read its own doc: this is the
          // server-side half of the PM-2047 trace — the rebuild committed and
          // validated, so the graph really is on the server's record.
          committedNodeIds = Object.keys(host.graph().nodes)
          // The deployed doc-host is a release ahead of this bundle, so every
          // frame it writes declares a version this build does not read. No
          // repair frame follows, because nothing is broken on the host side —
          // the two sides are simply pinned to different releases.
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

      // Setup checkpoint, still expected to pass: the doc subscription round
      // trip actually completed, carrying the skewed catch-up frame.
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

      // Setup checkpoint, still expected to pass: the agent's turn completes
      // and reports success in the panel — "agent says done".
      await expect(
        panel.getByRole('button', { name: SEND_LABEL })
      ).toBeVisible()
      await expect(panel.getByRole('button', { name: STOP_LABEL })).toHaveCount(
        0
      )
      await expect(panel.getByRole('button', { name: /^Worked/ })).toBeVisible()

      // The server-side half of the PM-2047 trace, asserted once the client has
      // actually subscribed: the rebuild committed and validated, so the graph
      // is on the server's own record (`draft_committed=true`, validated
      // ready-to-run, zero errors) before the version stamp was advanced.
      await expect
        .poll(() => committedNodeIds, { timeout: 20_000 })
        .toContain(String(ADDED_NODE_ID))

      // Unchanged and deliberately asserted: the gate still refuses. Reading a
      // document this build cannot read would be the fail-open failure KA-11
      // exists to prevent, so the node must NOT appear.
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toHaveCount(
        0
      )

      // The fix under test: the person is told why the canvas is empty,
      // instead of being left to refresh, re-login and reboot against a
      // comparison none of those can change. The notice names the cause —
      // an incompatible document version — and says the canvas was left
      // alone, which is what distinguishes it from a generic disconnect.
      const notice = page.getByTestId('toast')
      await expect(notice.getByText(SYNC_FAILED_TITLE)).toBeVisible({
        timeout: 15_000
      })
      await expect(
        notice.getByText(SYNC_FAILED_DETAIL, { exact: false })
      ).toBeVisible()
    })
  }
)
