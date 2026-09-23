import type { WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import { createI18n } from 'vue-i18n'

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
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Regression test for PM-1343: the in-app agent used to report a turn as
 * done while the canvas ended up with zero nodes.
 *
 * IF a doc's `meta.schema_version` ever becomes unreadable, the CRDT
 * follower's read-time schema gate (`assertReadableSchema`, KA-11) fails
 * closed. `LayoutFollowerBridge.onDocUpdate` used to latch that failure for
 * the ENTIRE document lineage — not just the one bad frame — so every later
 * same-lineage update, including a schema-version repair, was silently
 * dropped too, with no `doc_reset` ever following an ordinary tool call. The
 * agent's own turn still completed and reported success over the (unrelated)
 * chat channel, because nothing in that latch told the backend the browser
 * stopped projecting. Net effect: "agent says done" + "canvas has zero
 * nodes".
 *
 * `LayoutFollowerBridge` now re-checks the schema on every merged frame
 * instead of only the first, so a later same-lineage frame that restores a
 * readable `meta.schema_version` (the repair below) un-latches the gate, and
 * the `add_node` that follows it merges and projects normally.
 *
 * The trigger for the schema becoming unreadable in the first place is
 * unproven: tracing every doc-creation path in the `cloud` repo, all of them
 * go through the shared package's `mint()`, which unconditionally sets
 * `meta.schema_version` — there is no known code path that mints a doc
 * without one. Candidates for how it could still happen are a legacy row, a
 * stale `dochost` deploy, or a wire defect. This test simulates the missing
 * version with the test-only `corruptSchemaVersion()` helper below; it does
 * not reproduce a proven real-world trigger for that part.
 *
 * This spec drives the real agent panel against a fake doc host (`HostDoc`,
 * the same one `agentConversationFixture`/PM-1260's sibling repro use): the
 * first catch-up frame is corrupted to omit `meta.schema_version`, a
 * schema-version repair and an `add_node` tool call are then sent as their
 * own later frames on the same lineage, and the host applies that op to its
 * own authoritative document — and the node now reaches the live canvas the
 * user is looking at, because the repair frame un-latches the gate before the
 * `add_node` frame arrives.
 */

const WORKFLOW_ID = 'a3f6a3d2-7e3b-4b8a-9c1e-6e2a1c9f0a12'
const THREAD_ID = 'c9b6a9c0-9b1a-4b9b-8f0e-1a2b3c4d5e70'
const MESSAGE_ID = '0c5b1e77-2d4a-4f9e-8b63-1a2c3d4e5002'
const ADDED_NODE_ID = 9002
const NODE_TEXT = 'added after the schema gate tripped'
const SOCKET_SID = '7d1f2e3a-4b5c-4d6e-8f90-1a2b3c4d5e70'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = { nodes: [], links: [] }

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')

test.describe(
  'Agent canvas recovers after an unreadable doc schema is repaired',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('a node the agent reports adding reaches the canvas once the schema repair un-latches the gate', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
      const vueNodes = new VueNodeHelpers(page)

      let socket: WebSocketRoute | null = null

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
          // Simulates the unproven trigger this repro exercises (see file
          // header): the catch-up frame's merged doc has no readable
          // meta.schema_version at all.
          host.corruptSchemaVersion()
          send(host.subscribed())
          send(host.catchUp(state_vector_b64))
          // Sent as its own later-seq frame -- not folded silently into a
          // later apply()'s delta -- so the fix that stops the latch from
          // outliving one bad frame is exercised for real: this repair alone
          // is enough for the gate to pass again before the add_node frame
          // below arrives.
          send(host.repairSchemaVersion())
        })
      })

      await bootAgentApp(page, true, {
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        }
      })

      const panel = page.locator('#agent-panel-root')
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
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
      // trip (with its corrupted catch-up) actually completed.
      await expect.poll(() => socket !== null).toBe(true)

      const composer = panel.getByRole('textbox', { name: COMPOSER_LABEL })
      await composer.fill('Add a note to the canvas.')
      await panel.getByRole('button', { name: SEND_LABEL }).click()
      await expect(
        panel.getByText('Add a note to the canvas.').first()
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

      // The op lands on the host's own authoritative document, and is sent to
      // the browser the same way agentConversationFixture's replay does.
      send(
        host.apply([
          {
            op: 'add_node',
            pos: [0, 0],
            node: {
              id: ADDED_NODE_ID,
              pos: [0, 0],
              mode: 0,
              size: [200, 100],
              type: 'MarkdownNote',
              flags: {},
              order: 0,
              inputs: [],
              outputs: [],
              properties: {},
              widgets_values: [NODE_TEXT]
            },
            node_id: ADDED_NODE_ID,
            class_type: 'MarkdownNote'
          }
        ])
      )
      expect(Object.keys(host.graph().nodes)).toContain(String(ADDED_NODE_ID))

      send({
        type: 'agent_message_delta',
        data: {
          delta: 'Added a note to the canvas.',
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

      // The fix under test: the agent said it added the note, and the op is
      // on the host's own record (asserted above) -- both it and the earlier
      // schema-version repair were sent as their own frames. The repair
      // un-latches the schema gate before the add_node frame arrives, so the
      // node reaches the canvas the user is looking at instead of being
      // silently dropped alongside it.
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toBeVisible()
    })
  }
)
