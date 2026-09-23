import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import type { WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import { SUBSCRIBE_ACK_TIMEOUT_MS } from '@/workbench/extensions/agent/crdt/agentCrdtDocLifecycle'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

/**
 * Regression for "the agent says it added a node, but the canvas never shows
 * it".
 *
 * The tester's CRDT debug report showed `Connected: false` moments after the
 * complaint, with `add_node` operations present in the CRDT event log but
 * only 2 nodes in the follower's own document: the op was recorded
 * authoritatively, but the update carrying it never reached the connected
 * live canvas. This spec reproduces that shape directly: the doc host applies
 * an `add_node` op (the op enters the record) at the exact moment the
 * transport carrying it drops; the underlying websocket then reconnects (so
 * chat keeps working, matching "the agent reports it built the thing"), and
 * the host never answers the doc subscription that reconnect re-sends. The
 * follower has to notice the silence, retry the same-lineage subscribe once
 * the ack timeout expires, and land the node the agent added.
 */

const WORKFLOW_ID = 'a3f6a3d2-7e3b-4b8a-9c1e-6e2a1c9f0a11'
const THREAD_ID = 'c9b6a9c0-9b1a-4b9b-8f0e-1a2b3c4d5e6f'
const MESSAGE_ID = '0c5b1e77-2d4a-4f9e-8b63-1a2c3d4e5001'
const ADDED_NODE_ID = 9001
const NODE_TEXT = 'created while disconnected'
const SOCKET_SID = '7d1f2e3a-4b5c-4d6e-8f90-1a2b3c4d5e6f'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = { nodes: [], links: [] }

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop
// The composer names itself with the rendered message, escapes resolved.
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')

interface SubscriptionFrame {
  type: 'doc_subscribe' | 'doc_unsubscribe'
  stateVector: string | null
}

interface PostReconnectDocFrame extends SubscriptionFrame {
  at: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** The follower's subscription frames for the workflow under test, or null. */
function subscriptionFrameOf(raw: string | Buffer): SubscriptionFrame | null {
  const frame: unknown = JSON.parse(raw.toString())
  if (!isRecord(frame) || !isRecord(frame.data)) return null
  if (frame.type !== 'doc_subscribe' && frame.type !== 'doc_unsubscribe')
    return null
  if (frame.data.workflow_id !== WORKFLOW_ID) return null
  const { state_vector_b64 } = frame.data
  return {
    type: frame.type,
    stateVector: typeof state_vector_b64 === 'string' ? state_vector_b64 : null
  }
}

test.describe(
  'Agent graph op lost on disconnect',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('a node the agent adds while the doc connection drops still appears on the live canvas', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
      const vueNodes = new VueNodeHelpers(page)

      let socket: WebSocketRoute | null = null
      let connectionCount = 0
      const postReconnectDocFrames: PostReconnectDocFrame[] = []
      const postReconnectSubscribes = (): PostReconnectDocFrame[] =>
        postReconnectDocFrames.filter(({ type }) => type === 'doc_subscribe')

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
        connectionCount += 1
        const isFirstConnection = connectionCount === 1
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
          const frame = subscriptionFrameOf(raw)
          if (frame === null) return
          if (!isFirstConnection) {
            postReconnectDocFrames.push({ ...frame, at: Date.now() })
          }
          if (frame.type !== 'doc_subscribe' || frame.stateVector === null)
            return
          // The reconnect's re-subscribe never gets an answer: the general
          // realtime channel recovered (chat keeps flowing below), but the
          // host swallows the doc subscription frame. Only a retry of that
          // subscribe is answered.
          const swallowed =
            !isFirstConnection && postReconnectSubscribes().length === 1
          if (swallowed) return
          send(host.subscribed())
          send(host.catchUp(frame.stateVector))
        })
      })

      await bootAgentApp(page, true, {
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        }
      })

      const panel = page.locator('#agent-panel-root')
      await page
        .getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
        .click()
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

      // Setup checkpoint: the follower actually bound and subscribed once on
      // the first (and so far only) connection before anything goes wrong.
      await expect.poll(() => connectionCount).toBe(1)

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

      // The op lands on the authoritative document (the CRDT event log the
      // debug report quotes) ...
      const update = host.apply([
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
      expect(Object.keys(host.graph().nodes)).toContain(String(ADDED_NODE_ID))

      // ... but the transport drops right as that update would go out: the
      // frame is never sent, and the socket closes under the follower.
      void update
      await socket!.close()

      // The main realtime channel recovers (exactly one reconnect: chat keeps
      // working below), so the agent can still report success. The follower's
      // re-subscribe went out on the new socket and is being ignored.
      await expect.poll(() => connectionCount).toBe(2)
      await expect.poll(() => postReconnectDocFrames.length).toBe(1)
      expect(postReconnectDocFrames.map(({ type }) => type)).toEqual([
        'doc_subscribe'
      ])

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

      // Setup checkpoint: the agent's turn completes and reports success in
      // the panel, exactly as the tester saw it do.
      await expect(
        panel.getByRole('button', { name: SEND_LABEL })
      ).toBeVisible()
      await expect(panel.getByRole('button', { name: STOP_LABEL })).toHaveCount(
        0
      )
      await expect(panel.getByRole('button', { name: /^Worked/ })).toBeVisible()

      // The agent said it added the note, and the op is in the document's own
      // record (asserted above). The follower must notice that its subscribe
      // was never acknowledged, retry it, and land the node on the live canvas.
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toBeVisible({
        timeout: SUBSCRIBE_ACK_TIMEOUT_MS + 10_000
      })

      // The retry is the fix's fingerprint: one more `doc_subscribe` on the
      // same lineage (unchanged state vector, no unsubscribe in between) after
      // the ack timeout, never an immediate retarget or a reset.
      await expect
        .poll(() => postReconnectSubscribes().length, {
          message: 'the follower never retried the unanswered doc_subscribe'
        })
        .toBe(2)
      expect(postReconnectDocFrames.map(({ type }) => type)).toEqual([
        'doc_subscribe',
        'doc_subscribe'
      ])
      const [silenced, retried] = postReconnectSubscribes()
      expect(retried.stateVector).toBe(silenced.stateVector)
      expect(retried.at - silenced.at).toBeGreaterThanOrEqual(
        SUBSCRIBE_ACK_TIMEOUT_MS - 500
      )
    })
  }
)
