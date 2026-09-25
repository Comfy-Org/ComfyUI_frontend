import type { Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import { createI18n } from 'vue-i18n'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import {
  STALE_AFTER_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS
} from '@/workbench/extensions/agent/crdt/agentCrdtDocLifecycle'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Regression coverage for the Jo Zhang / PM-1406-shaped report (nightly,
 * 2026-09-20): asking the in-app agent to run the workflow on the canvas made
 * the canvas go fully blank the moment the agent started working, for the
 * whole run, with every node reappearing at once once the run finished.
 *
 * Two mechanisms combined to produce exactly that timeline:
 *
 * 1. A `doc_reset` (or `follower_replaced`) frame used to sweep every live
 *    node off the canvas synchronously, before any replacement content
 *    existed. Which backend path emits a reset for a plain, edit-free "run
 *    the workflow" turn was never confirmed; this suite injects one
 *    explicitly. A reset now only arms the next frame to replace the graph
 *    (`AgentCrdtProjection.replaceOnNextFrame`), so the nodes the user is
 *    looking at stay put until the new lineage's first frame lands.
 * 2. The resubscribe that follows a reset can be acknowledged
 *    (`doc_subscribed: {ok: true}`) WITHOUT its catch-up `doc_update` frame.
 *    The bug report's own debug log shows this anomaly for real. Recovery
 *    used to wait for the passive 30-second stale probe (`STALE_AFTER_MS`);
 *    a confirmed subscribe without content now also arms the active
 *    `SUBSCRIBE_CATCHUP_GRACE_MS` probe.
 *
 * Three tests share the drive-to-doc-reset arrange step below. The host
 * doc gains a third node right after the reset, so a canvas that shows it
 * proves the new lineage's catch-up was applied rather than the old nodes
 * merely surviving. The first test holds a PERMANENTLY dropped catch-up
 * through a whole run and checks the two nodes never leave the canvas; the
 * second lets the passive stale probe deliver the new lineage; the third
 * proves the PM-1406 fix: a TRANSIENT (one-off) dropped catch-up recovers via
 * the active probe well inside the run's own duration.
 */

const WORKFLOW_ID = 'b7e2f1a4-9c3d-4e5f-8a6b-1d2c3e4f5a6b'
const THREAD_ID = 'd4c5b6a7-8e9f-4a1b-9c2d-3e4f5a6b7c8d'
const MESSAGE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e'
const SOCKET_SID = '9f8e7d6c-5b4a-4c3d-8e1f-2a3b4c5d6e7f'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const RESET_LINEAGE_NODE_ID = 3
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

/**
 * Parses a raw `/ws` message down to its `doc_subscribe` payload, or `null`
 * if the frame is malformed or is some other frame type. Extracted from the
 * mock's `onMessage` handler to keep that handler's branching to the
 * post-parse decisions (reset-gating, catch-up dropping).
 */
function parseDocSubscribeData(
  raw: Buffer | string
): Record<string, unknown> | null {
  const frame: unknown = JSON.parse(raw.toString())
  if (typeof frame !== 'object' || frame === null) return null
  const { type, data } = frame as { type?: unknown; data?: unknown }
  if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
    return null
  return data as Record<string, unknown>
}

/**
 * Validates a parsed `doc_subscribe` payload against the workflow under
 * test and extracts the state vector the mock needs to build a catch-up
 * frame. Returns `null` for any other workflow's subscribe (there are
 * none in this suite, but the guard mirrors the shape a real backend would
 * check).
 */
function parseDocSubscribeFields(
  data: Record<string, unknown>
): { stateVectorB64: string } | null {
  const { workflow_id, state_vector_b64 } = data as {
    workflow_id?: unknown
    state_vector_b64?: unknown
  }
  if (workflow_id !== WORKFLOW_ID || typeof state_vector_b64 !== 'string')
    return null
  return { stateVectorB64: state_vector_b64 }
}

/**
 * Drives a plain "run the workflow" turn up through a mid-turn `doc_reset`
 * whose post-reset resubscribes have their catch-up withheld per
 * `dropCatchUpAfterReset`, and asserts the canvas keeps its two nodes the
 * moment the reset lands. The host doc gains `RESET_LINEAGE_NODE_ID` right
 * after the reset, so only a delivered catch-up can put a third node on the
 * canvas. Shared by the permanent-drop run (`driveRunTurnThroughRun`) and
 * the transient one-off-drop recovery proof
 * (`driveRunTurnThroughTransientCatchUpDrop`) below -- they differ only in
 * how many of the resubscribes that follow the reset get their catch-up
 * withheld.
 *
 * `dropCatchUpAfterReset` is asked, for each `doc_subscribe` the mock
 * receives AFTER the reset, whether that resubscribe (1-indexed, in receipt
 * order) should have its catch-up withheld. The subscribe sent before the
 * reset (the initial workflow-picker subscribe) always gets its catch-up --
 * matching the baseline "two nodes visible" assertion below.
 */
async function driveThroughDocReset(
  page: Page,
  dropCatchUpAfterReset: (resubscribeCountAfterReset: number) => boolean
): Promise<{
  vueNodes: VueNodeHelpers
  send: (frame: AgentWsEvent | HostFrame) => void
}> {
  const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
  const vueNodes = new VueNodeHelpers(page)

  let socket: WebSocketRoute | null = null
  let resetSent = false
  let resubscribeCountAfterReset = 0

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
      const data = parseDocSubscribeData(raw)
      if (data === null) return
      const fields = parseDocSubscribeFields(data)
      if (fields === null) return
      send(host.subscribed())
      if (!resetSent) {
        send(host.catchUp(fields.stateVectorB64))
        return
      }
      resubscribeCountAfterReset += 1
      if (!dropCatchUpAfterReset(resubscribeCountAfterReset))
        send(host.catchUp(fields.stateVectorB64))
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

  const composer = panel.getByRole('textbox', { name: COMPOSER_LABEL })
  await composer.fill('Run the workflow.')
  await panel.getByRole('button', { name: SEND_LABEL }).click()
  await expect(panel.getByText('Run the workflow.').first()).toBeVisible()

  // The panel doesn't bind (and so doesn't subscribe) the CRDT doc merely
  // from selecting a workflow as the agent's target -- `boundWorkflowId`
  // (`useAgentSession.ts`) only changes via `bindWorkflow`, which fires from
  // this `agent_active_tab` push (`AgentPanelRoot.vue`'s `onAgentActiveTab`).
  // The first real subscribe -- and so the seed's two nodes -- can only
  // appear after this frame, not merely after picking the workflow tab.
  send({
    type: 'agent_active_tab',
    data: {
      workflow_id: WORKFLOW_ID,
      name: 'Unsaved Workflow',
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID
    }
  })

  // Baseline: the healthy first subscribe delivers the seed's two nodes,
  // matching the user's report that the canvas held the workflow's nodes
  // before the agent started working on the run.
  await expect(vueNodes.getNodeLocator('1')).toBeVisible()
  await expect(vueNodes.getNodeLocator('2')).toBeVisible()

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

  // "The moment the agent started working": a lineage break for the active
  // document right as the run-only turn gets going. This used to be the one
  // frame able to sweep already-rendered nodes off the canvas; now it only
  // arms the next frame to replace the graph. From here on the resubscribe's
  // catch-up is governed by `dropCatchUpAfterReset`.
  resetSent = true
  send({
    type: 'doc_reset',
    data: {
      v: 1,
      workflow_id: WORKFLOW_ID,
      seq: 2,
      actor: 'system:mint'
    }
  })
  host.apply([
    {
      op: 'add_node',
      pos: [600, 0],
      node: {
        id: RESET_LINEAGE_NODE_ID,
        pos: [600, 0],
        mode: 0,
        size: [200, 100],
        type: 'MarkdownNote',
        flags: {},
        order: 2,
        inputs: [],
        outputs: [],
        properties: {},
        widgets_values: ['added after the reset']
      },
      node_id: RESET_LINEAGE_NODE_ID,
      class_type: 'MarkdownNote'
    }
  ])

  await expect(vueNodes.getNodeLocator('1')).toBeVisible()
  await expect(vueNodes.getNodeLocator('2')).toBeVisible()

  return { vueNodes, send }
}

/**
 * Drives a plain "run the workflow" turn through a mid-turn `doc_reset` whose
 * resubscribe's catch-up is silently dropped (the bug report's own debug-log
 * anomaly) FOR EVERY resubscribe that follows, up through the agent
 * reporting the turn done -- the point where only the passive 30s stale-probe
 * can force a real resubscribe. Installs and advances `page.clock` by the
 * run's own duration (15386ms, from the bug report's tool-call trace) so both
 * callers can pick up the clock exactly where the run left it.
 */
async function driveRunTurnThroughRun(page: Page): Promise<{
  vueNodes: VueNodeHelpers
  setDropCatchUp: (value: boolean) => void
}> {
  // Toggled to simulate the exact anomaly in the bug report's own debug log:
  // a `doc_subscribed:ok` that is not followed by its catch-up `doc_update`.
  // Callers flip this back to false to let the passive stale-probe's
  // resubscribe actually deliver content.
  let dropCatchUp = true
  const { vueNodes, send } = await driveThroughDocReset(page, () => dropCatchUp)

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

  // The run itself is healthy throughout -- wait_for_job takes the 15386ms
  // the bug report's own tool-call trace recorded -- while the resubscribe's
  // ack carried no content.
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

  const panel = page.locator('#agent-panel-root')
  await expect(panel.getByRole('button', { name: /^Worked/ })).toBeVisible()

  return {
    vueNodes,
    setDropCatchUp: (value: boolean) => {
      dropCatchUp = value
    }
  }
}

/**
 * PM-1406 flip proof: drives the same run turn through the same mid-turn
 * `doc_reset`, but the anomaly this time is TRANSIENT -- only the very first
 * resubscribe that follows the reset has its catch-up withheld, exactly as a
 * real backend that would satisfy the next retry attempt. Under the old
 * passive-only recovery this would still cost the full `STALE_AFTER_MS`
 * heartbeat, because nothing but that heartbeat ever issues a second
 * resubscribe. Under the fix, `onSubscribeConfirmed` arms the
 * `SUBSCRIBE_CATCHUP_GRACE_MS` probe right after the first (catch-up-less)
 * confirm, fires a second resubscribe well inside the run's own duration, and
 * that second attempt is the one this mock actually delivers content for.
 */
async function driveRunTurnThroughTransientCatchUpDrop(page: Page): Promise<{
  vueNodes: VueNodeHelpers
}> {
  const { vueNodes } = await driveThroughDocReset(
    page,
    (resubscribeCountAfterReset) => resubscribeCountAfterReset === 1
  )
  return { vueNodes }
}

test.describe(
  'Agent canvas survives a mid-turn doc reset for the length of a run',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('keeps the two-node canvas through a run whose post-reset catch-up never arrives', async ({
      page
    }) => {
      const { vueNodes } = await driveRunTurnThroughRun(page)

      await expect(vueNodes.getNodeLocator('1')).toBeVisible()
      await expect(vueNodes.getNodeLocator('2')).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(RESET_LINEAGE_NODE_ID))
      ).toHaveCount(0)
    })

    test('recovers once the passive stale-probe forces a real resubscribe', async ({
      page
    }) => {
      const { vueNodes, setDropCatchUp } = await driveRunTurnThroughRun(page)

      // Fast-forwarding the remaining budget up to STALE_AFTER_MS lets the
      // passive stale-probe fire its own resubscribe, this time with
      // catch-up content restored: the new lineage replaces the graph.
      setDropCatchUp(false)
      await page.clock.fastForward(STALE_AFTER_MS - 15_386 + 1_000)
      await expect(
        vueNodes.getNodeLocator(String(RESET_LINEAGE_NODE_ID))
      ).toBeVisible()
      await expect(vueNodes.getNodeLocator('1')).toBeVisible()
      await expect(vueNodes.getNodeLocator('2')).toBeVisible()
    })

    test('PM-1406 fix: a one-off dropped catch-up recovers via the active probe, well before the run completes', async ({
      page
    }) => {
      const { vueNodes } = await driveRunTurnThroughTransientCatchUpDrop(page)

      await page.clock.install()
      // Only SUBSCRIBE_CATCHUP_GRACE_MS (2s) needs to elapse: the confirmed
      // subscribe from the dropped-catch-up resubscribe arms the active
      // probe at this short grace delay instead of the full STALE_AFTER_MS
      // (30s) budget, and this transient anomaly's very next resubscribe is
      // the one the mock actually delivers content for. Pre-fix,
      // `onSubscribeConfirmed` armed only the full 30s heartbeat, so this
      // same one-off drop would still show the old lineage at this point for
      // another ~28s -- well past the run's own 15,386ms duration.
      await page.clock.fastForward(SUBSCRIBE_CATCHUP_GRACE_MS + 1_000)

      await expect(
        vueNodes.getNodeLocator(String(RESET_LINEAGE_NODE_ID))
      ).toBeVisible()
      await expect(vueNodes.getNodeLocator('1')).toBeVisible()
      await expect(vueNodes.getNodeLocator('2')).toBeVisible()
    })
  }
)
