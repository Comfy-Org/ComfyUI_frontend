import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import { createI18n } from 'vue-i18n'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/schemas/apiSchema'

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
 * Repro for PM-1575 / PM-1576 (stagingcloud, 2026-09): every agent tool call
 * that touches the canvas reports done -- the chat trace's spinner settles,
 * the turn's "Worked for Xs" summary appears -- roughly 10 real seconds
 * before the node it added actually materializes on the canvas. Unlike
 * PM-1355/#18179 (`agentCanvasBlanksDuringRunTurn.spec.ts`), this is not a
 * `doc_reset`-triggered blank canvas recovering off a client heartbeat: it
 * happens on an ORDINARY tool call, with no reset, refusal or disconnect in
 * the picture, and it always eventually renders.
 *
 * What is confirmed, by reading the code (not by telemetry this task does not
 * have access to):
 *
 * `createAgentEventTransport`'s `ingest()` (`agentEventTransport.ts:86-108`)
 * flips a tool part's `state` to `'done'` -- the ONLY thing
 * `AgentMessage.vue`'s `composing`/`status` computeds (`AgentMessage.vue:92-121`)
 * read to decide whether to keep showing the spinner -- the instant an
 * `agent_tool_call` frame with `status !== 'running'` arrives. That frame
 * travels the chat half of the same websocket. Nothing in that function, or
 * anywhere else this task found under
 * `src/workbench/extensions/agent/services/agent/` or
 * `src/workbench/extensions/agent/components/agent/message/`, reads
 * `useAgentCrdtFollower`'s status, the bridge's `lastSequence`, or anything
 * else from the CRDT doc half. The two signals are wired to completely
 * disjoint listeners on `bridge`/`client` (`useAgentCrdtFollower.ts:593-603`)
 * and `AgentEventTransport` (`agentEventTransport.ts`) respectively, and
 * neither one waits on the other. So the "done" affordance is structurally
 * incapable of reflecting whether the corresponding `doc_update` has landed --
 * confirmed, not hypothesized.
 *
 * What is NOT confirmed: why the doc-side broadcast specifically takes ~10 s
 * to catch up in stagingcloud. That number does not match any client-side
 * timer this task found (`STALE_AFTER_MS` is 30 s, `SUBSCRIBE_CATCHUP_GRACE_MS`
 * is 2 s, `SUBSCRIBE_ACK_TIMEOUT_MS` is 15 s, `opSender.ts`'s
 * `RESULT_TIMEOUT_MS` -- the closest 10 s constant in this codebase -- times
 * out the HUMAN write leg's own result wait, not anything on the read/follower
 * side an agent-authored update travels). The likely remaining explanation is
 * a server-side ("doc host") propagation delay between committing an agent
 * op and broadcasting its `doc_update` to subscribed followers, separate from
 * the chat completion ack -- but this repo has no visibility into that
 * service, so this spec pins the OBSERVABLE client-side gap (completion
 * affordance fires; canvas does not reflect it for a long, but bounded,
 * interval) rather than claiming a specific backend root cause.
 *
 * The fix (client-side decoupling only -- the backend propagation delay
 * itself is out of scope): `createAgentEventTransport` now takes an optional
 * `shouldAwaitCanvasSync` gate. While it returns true, a tool call's `state`
 * is held at `'streaming'` when its frame reports done, instead of flipping
 * straight to `'done'`, until either `notifyCanvasCaughtUp()` is called or
 * `STALE_AFTER_MS` elapses (the same bound `agentCrdtDocLifecycle.ts`'s own
 * passive heartbeat uses). `AgentPanelRoot.vue` wires the gate to
 * `agentPanelStore.enabled` and calls `notifyCanvasCaughtUp()` whenever
 * `useAgentCrdtFollower`'s `outcomes.applied` counter increases for the bound
 * workflow -- mirroring, not reusing, PM-1355's own catch-up-confirmation
 * primitive, since that one lives inside `AgentCrdtDocLifecycle` and answers
 * "is THIS subscribe's own catch-up frame overdue", not "has some later
 * update since landed", which is the question this bug needed answered.
 */

const WORKFLOW_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const THREAD_ID = 'f0e1d2c3-b4a5-4968-8172-6354a3b2c1d0'
const MESSAGE_ID = '1e2d3c4b-5a69-4788-9061-52f3e4d5c6b7'
const ADDED_NODE_ID = 4242
const NODE_TEXT = 'added while the doc broadcast lags'
const SOCKET_SID = 'a9b8c7d6-e5f4-4321-8a9b-0c1d2e3f4a5b'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = { nodes: [], links: [] }

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const SEND_LABEL = enMessages.agent.send
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')

// core/1.54's ToolCallGroup.vue (main's WorkSummary.vue on this branch) keeps
// itself expanded for as long as any tool part is still 'streaming' -- which,
// under this very fix, can outlast the turn's own settle -- so the trigger
// may already be open by the time a test gets here. A plain click would then
// toggle it CLOSED instead of opening it.
async function expandToolCallGroup(trigger: Locator): Promise<void> {
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click()
  }
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
}

/** The follower's `doc_subscribe` payload for the workflow under test, or null. */
function subscribeStateVectorOf(raw: Buffer | string): string | null {
  const frame: unknown = JSON.parse(raw.toString())
  if (typeof frame !== 'object' || frame === null) return null
  const { type, data } = frame as { type?: unknown; data?: unknown }
  if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
    return null
  const { workflow_id, state_vector_b64 } = data as {
    workflow_id?: unknown
    state_vector_b64?: unknown
  }
  if (workflow_id !== WORKFLOW_ID || typeof state_vector_b64 !== 'string')
    return null
  return state_vector_b64
}

/**
 * Drives one "add a note to the canvas" turn through to the agent reporting
 * it done -- the tool call's own completion AND the turn's "Worked for Xs"
 * summary, matching the bug report's "every working affordance" -- while the
 * doc host has ALREADY recorded the `add_node` op authoritatively
 * (`host.apply` below) but its broadcast `doc_update` is deliberately held
 * back. Callers decide when (if ever) to release it via the returned
 * `sendDelayedDocUpdate`.
 */
async function driveThroughToolCallDone(
  page: Page,
  /**
   * The healthy-doc-host ordering is the tool call's own terminal frame
   * landing before the matching `doc_update` broadcast -- that is what every
   * scenario above exercises. 'docUpdateBeforeToolCall' instead releases the
   * (already-applied, see `host.apply` below) `doc_update` BEFORE the
   * `agent_tool_call success` frame, to exercise the inverted ordering a
   * lost-wakeup regression in `notifyCanvasCaughtUp`'s edge-triggering would
   * strand at `STALE_AFTER_MS` even though the canvas had already caught up.
   */
  order:
    | 'toolCallBeforeDocUpdate'
    | 'docUpdateBeforeToolCall' = 'toolCallBeforeDocUpdate'
): Promise<{
  vueNodes: VueNodeHelpers
  sendDelayedDocUpdate: () => void
}> {
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
      const stateVector = subscribeStateVectorOf(raw)
      if (stateVector === null) return
      send(host.subscribed())
      send(host.catchUp(stateVector))
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

  // The doc host records the op on its authoritative document as soon as the
  // tool actually executes -- this is not a race the agent lost, the op is
  // real -- independent of when its broadcast reaches this client relative
  // to the tool call's own terminal frame, which `order` controls below.
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

  // The inverted ordering: the doc_update broadcast reaches this client
  // while the tool is still (from the chat frames' perspective) running --
  // the healthy-doc-host case most reviewers flagged as the lost-wakeup risk
  // for notifyCanvasCaughtUp()'s edge triggering.
  if (order === 'docUpdateBeforeToolCall') send(update)

  // The tool-call-completion affordance: `agentEventTransport.ts`'s `ingest()`
  // flips this tool part `done` the instant this frame is read, purely from
  // `status`, with nothing checked on the CRDT doc side (see file header).
  send({
    type: 'agent_tool_call',
    data: {
      tool_call_id: 'call-add-node',
      tool_name: 'add_node',
      status: 'success',
      duration_ms: 90,
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID
    }
  })
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

  // Setup checkpoint: every working affordance the report names has settled --
  // the composer is free again and the turn's own "Worked for Xs" summary is
  // up -- while the canvas (asserted by the caller) has nothing yet.
  await expect(panel.getByRole('button', { name: SEND_LABEL })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Ran/ })).toBeVisible()

  return {
    vueNodes,
    // A no-op once `order` already sent it above -- resending the same
    // update twice is not part of what either ordering means to exercise.
    sendDelayedDocUpdate: () => {
      if (order !== 'docUpdateBeforeToolCall') send(update)
    }
  }
}

test.describe(
  'Agent canvas lags every tool-call completion by the doc broadcast delay',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('the tool call stays visibly syncing -- not done -- until the canvas actually catches up', async ({
      page
    }) => {
      const { vueNodes, sendDelayedDocUpdate } =
        await driveThroughToolCallDone(page)

      // The turn's own summary settled instantly (asserted inside the arrange
      // step above), matching the report's "every working affordance" -- but
      // the fix under test lives one level down, on the tool call's OWN
      // displayed state inside that summary: expand it to look.
      const panel = page.locator('#agent-panel-root')
      const workSummary = panel.getByRole('button', { name: /^Ran/ })
      await expandToolCallGroup(workSummary)

      const addNodeRow = panel
        .getByRole('listitem')
        .filter({ hasText: 'Add node' })
      await expect(addNodeRow).toBeVisible()

      // The fix: an `agent_tool_call` frame's own `status: 'success'` is no
      // longer enough on its own to flip this row to "done" -- it stays on the
      // same spinning glyph it showed while the tool was still running,
      // because the canvas has not caught up to it yet (zero nodes, asserted
      // below). Pre-fix, `ingest()` flipped this straight to the settled
      // wrench glyph the instant the frame arrived, regardless of the canvas.
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toBeVisible()
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toHaveCount(
        0
      )

      // Once the doc host's delayed broadcast actually lands, the tool call's
      // own displayed state catches up in the same moment its node does -- the
      // "done" affordance and canvas reality are no longer decoupled.
      sendDelayedDocUpdate()
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toHaveCount(
        0
      )
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toBeVisible()
    })

    test('the node does eventually land once the delayed doc_update actually arrives', async ({
      page
    }) => {
      const { vueNodes, sendDelayedDocUpdate } =
        await driveThroughToolCallDone(page)

      // Not a permanent blank canvas (unlike PM-1355): once the doc host's own
      // broadcast finally goes out -- stagingcloud's own reported ~10 s --
      // the follower applies it exactly like any other live update and the
      // node lands, with no reset or resubscribe involved.
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toHaveCount(
        0
      )
      sendDelayedDocUpdate()
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toBeVisible()
    })

    // Regression for the lost-wakeup case flagged during review: on a
    // healthy doc host the broadcast can just as well reach this client
    // BEFORE the tool call's own terminal frame -- notifyCanvasCaughtUp()
    // firing while nothing is pending yet must not be a no-op that strands
    // the row at its full STALE_AFTER_MS fallback once the tool call's
    // success frame arrives after the canvas already caught up.
    test('settles immediately when the doc_update lands before the tool call reports done', async ({
      page
    }) => {
      const { vueNodes } = await driveThroughToolCallDone(
        page,
        'docUpdateBeforeToolCall'
      )

      const panel = page.locator('#agent-panel-root')
      const workSummary = panel.getByRole('button', { name: /^Ran/ })
      await expandToolCallGroup(workSummary)

      const addNodeRow = panel
        .getByRole('listitem')
        .filter({ hasText: 'Add node' })
      await expect(addNodeRow).toBeVisible()
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toHaveCount(
        0
      )
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toBeVisible()
    })
  }
)
