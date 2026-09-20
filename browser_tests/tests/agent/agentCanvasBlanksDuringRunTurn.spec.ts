import type { WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import { createI18n } from 'vue-i18n'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import { STALE_AFTER_MS } from '@/workbench/extensions/agent/crdt/agentCrdtDocLifecycle'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Repro for the Jo Zhang / PM-1355-shaped report (nightly, 2026-09-20): asking
 * the in-app agent to run the workflow on the canvas makes the canvas go
 * fully blank the moment the agent starts working, for the whole run, with
 * every node reappearing at once once the run finishes.
 *
 * Two mechanisms combine to produce exactly that timeline, both real and
 * independently confirmed by reading `useAgentCrdtFollower.ts` and
 * `agentCrdtDocLifecycle.ts` on current `main`:
 *
 * 1. A `doc_reset` (or `follower_replaced`) frame makes
 *    `LayoutFollowerBridge`/`AgentCrdtProjection.clearForReset` sweep every
 *    live materialized node off the canvas SYNCHRONOUSLY, before any
 *    replacement content exists (`agentCrdtProjection.ts`). This is the only
 *    path that actively removes already-rendered nodes -- this repro injects
 *    it explicitly because the exact backend condition that would emit one
 *    for a plain, edit-free "run the workflow" turn was NOT found: the `run`
 *    / `wait_for_job` / `get_output` tool implementations
 *    (`cloud/services/agent/internal/loop/tools.go`) make no calls into the
 *    CRDT doc store at all, and the turn-start reconciliation that CAN emit a
 *    reset (`ensureDoc`/`prepareWorkflow` in
 *    `cloud/services/agent/internal/loop/crdt.go`) is heavily unit-tested
 *    against firing on an unmodified canvas. Which backend path actually
 *    emitted the reset in production remains unconfirmed; this repro pins
 *    what the user sees once one is emitted, for whatever reason.
 * 2. The resubscribe that follows a reset can be acknowledged
 *    (`doc_subscribed: {ok: true}`) WITHOUT its catch-up `doc_update` frame.
 *    The bug report's own attached debug log shows this exact anomaly for
 *    real, on a different (later, smaller) workflow in the same session: a
 *    `doc_subscribed:ok` with no accompanying `doc_update`, followed 30
 *    seconds later -- exactly `STALE_AFTER_MS`
 *    (`agentCrdtDocLifecycle.ts`) -- by the passive stale-probe's forced
 *    resubscribe, which is the one that actually delivers content and
 *    materializes the nodes. There is no faster, active recovery: a
 *    server-confirmed subscribe with no update arms only the 30-second
 *    heartbeat (see `useAgentCrdtFollower.test.ts`'s "a confirmed subscribe
 *    clears the retry timer", which pins exactly this passive window as
 *    intended behavior).
 *
 * Together: whatever triggers the reset, the canvas can sit fully blank for
 * up to 30 real seconds afterward with zero active recovery -- comfortably
 * spanning one generation run (the bug report's own run + wait_for_job took
 * 15386ms) -- which is sufficient on its own to produce the reported
 * timeline: blank the instant the agent starts working, blank for the whole
 * run, all nodes back at once, unrelated to whether the run itself finished.
 */

const WORKFLOW_ID = 'b7e2f1a4-9c3d-4e5f-8a6b-1d2c3e4f5a6b'
const THREAD_ID = 'd4c5b6a7-8e9f-4a1b-9c2d-3e4f5a6b7c8d'
const MESSAGE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e'
const SOCKET_SID = '9f8e7d6c-5b4a-4c3d-8e1f-2a3b4c5d6e7f'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = {
  nodes: [
    {
      id: 1,
      pos: [0, 0],
      mode: 0,
      size: [200, 100],
      type: 'MarkdownNote',
      flags: {},
      order: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['first node']
    },
    {
      id: 2,
      pos: [300, 0],
      mode: 0,
      size: [200, 100],
      type: 'MarkdownNote',
      flags: {},
      order: 1,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['second node']
    }
  ],
  links: []
}

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const SEND_LABEL = enMessages.agent.send
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')

test.describe(
  'Agent canvas blanks for the length of a run after a mid-turn doc reset',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('the two-node canvas empties at run start and only recovers once the passive stale-probe forces a real resubscribe', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
      const vueNodes = new VueNodeHelpers(page)

      let socket: WebSocketRoute | null = null
      // Toggled to simulate the exact anomaly in the bug report's own debug
      // log: a `doc_subscribed:ok` that is not followed by its catch-up
      // `doc_update`. Flip to false once the passive stale-probe forces the
      // recovering resubscribe.
      let dropCatchUp = false

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
      await page.route('**/api/agent/threads/*/asks/*/answer', (route) =>
        route.fulfill(jsonRoute({ ok: true }))
      )
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
          send(host.subscribed())
          if (!dropCatchUp) send(host.catchUp(state_vector_b64))
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

      await expect.poll(() => socket !== null).toBe(true)

      // Baseline: the healthy first subscribe delivers the seed's two nodes,
      // matching the user's report that the canvas held the workflow's nodes
      // before asking the agent to run it.
      await expect(vueNodes.getNodeLocator('1')).toBeVisible()
      await expect(vueNodes.getNodeLocator('2')).toBeVisible()

      const composer = panel.getByRole('textbox', { name: COMPOSER_LABEL })
      await composer.fill('Run the workflow.')
      await panel.getByRole('button', { name: SEND_LABEL }).click()
      await expect(panel.getByText('Run the workflow.').first()).toBeVisible()

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
          tool_call_id: 'call-print',
          tool_name: 'print_workflow',
          status: 'success',
          duration_ms: 40,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })
      send({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-validate',
          tool_name: 'validate',
          status: 'success',
          duration_ms: 220,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })

      // "The moment the agent started working": a lineage break for the
      // active document right as the run-only turn gets going. This is the
      // one frame able to actively sweep already-rendered nodes off the
      // canvas (`AgentCrdtProjection.clearForReset` /
      // `useAgentCrdtFollower`'s `onDocReset`); which backend path emits it
      // for an edit-free run turn is the open half of this RCA (see the
      // file-level comment). From here on the resubscribe's catch-up is
      // silently dropped, reproducing the bug report's own debug-log anomaly.
      dropCatchUp = true
      send({
        type: 'doc_reset',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          seq: 2,
          actor: 'system:mint'
        }
      })

      await expect(vueNodes.getNodeLocator('1')).toHaveCount(0)
      await expect(vueNodes.getNodeLocator('2')).toHaveCount(0)

      send({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-run',
          tool_name: 'run',
          status: 'success',
          duration_ms: 180,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })

      // The run itself is healthy throughout -- wait_for_job takes the
      // 15386ms the bug report's own tool-call trace recorded -- but the
      // canvas has nothing to show: the resubscribe's ack carried no content,
      // and only the passive 30s heartbeat can force a real one.
      await page.clock.install()
      await page.clock.fastForward(15_386)
      send({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-wait',
          tool_name: 'wait_for_job',
          status: 'success',
          duration_ms: 15_386,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })
      send({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-output',
          tool_name: 'get_output',
          status: 'success',
          duration_ms: 90,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })
      send({
        type: 'agent_message_delta',
        data: { delta: 'Done.', thread_id: THREAD_ID, message_id: MESSAGE_ID }
      })
      send({
        type: 'agent_message_done',
        data: { thread_id: THREAD_ID, message_id: MESSAGE_ID, usage: null }
      })

      // The known defect, held right at run completion: the agent reports
      // the run finished, but the canvas the user is looking at still has
      // zero nodes, because nothing beyond the run's own duration has forced
      // a working resubscribe yet.
      await expect(panel.getByRole('button', { name: /^Worked/ })).toBeVisible()
      test.fail()
      await expect(vueNodes.getNodeLocator('1')).toBeVisible()
      await expect(vueNodes.getNodeLocator('2')).toBeVisible()

      // Past this point (documentation, not part of the expected-failure
      // assertion above): fast-forwarding the remaining budget up to
      // STALE_AFTER_MS lets the passive stale-probe fire its own resubscribe,
      // this time with catch-up content restored, and the nodes return --
      // the "all nodes came back to the canvas" half of the report.
      dropCatchUp = false
      await page.clock.fastForward(STALE_AFTER_MS - 15_386 + 1_000)
      await expect(vueNodes.getNodeLocator('1')).toBeVisible()
      await expect(vueNodes.getNodeLocator('2')).toBeVisible()
    })
  }
)
