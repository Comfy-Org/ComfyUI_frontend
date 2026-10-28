import type { Page } from '@playwright/test'
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
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'

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
const UNRELATED_NODE_ID = 4241
const SECOND_NODE_ID = 4243
const NODE_TEXT = 'added while the doc broadcast lags'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = { nodes: [], links: [] }

const SEND_LABEL = enMessages.agent.send

async function driveThroughToolCallDone(
  page: Page,
  order:
    | 'toolCallBeforeDocUpdate'
    | 'docUpdateBeforeToolCall' = 'toolCallBeforeDocUpdate',
  includeUnrelatedUpdate = false,
  includeSecondOpUpdate = false
): Promise<{
  vueNodes: VueNodeHelpers
  sendUnrelatedDocUpdate: () => void
  sendDelayedDocUpdate: () => void
  sendSecondOpDocUpdate: () => void
}> {
  const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
  const vueNodes = new VueNodeHelpers(page)

  const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)

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
  await new AgentPanel(page).open(30_000)

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

  const composer = panel.getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
  await composer.fill('Add a note to the canvas.')
  await panel.getByRole('button', { name: SEND_LABEL }).click()
  await expect(
    panel.getByText('Add a note to the canvas.').first()
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

  const unrelatedUpdate = includeUnrelatedUpdate
    ? host.apply([
        {
          op: 'add_node',
          pos: [250, 0],
          node: {
            id: UNRELATED_NODE_ID,
            pos: [250, 0],
            mode: 0,
            size: [200, 100],
            type: 'MarkdownNote',
            flags: {},
            order: 0,
            inputs: [],
            outputs: [],
            properties: {},
            widgets_values: ['unrelated document operation']
          },
          node_id: UNRELATED_NODE_ID,
          class_type: 'MarkdownNote'
        }
      ])
    : null
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
  const secondOpUpdate = includeSecondOpUpdate
    ? host.apply([
        {
          op: 'add_node',
          pos: [0, 250],
          node: {
            id: SECOND_NODE_ID,
            pos: [0, 250],
            mode: 0,
            size: [200, 100],
            type: 'MarkdownNote',
            flags: {},
            order: 0,
            inputs: [],
            outputs: [],
            properties: {},
            widgets_values: ['second operation of the same tool call']
          },
          node_id: SECOND_NODE_ID,
          class_type: 'MarkdownNote'
        }
      ])
    : null
  expect(Object.keys(host.graph().nodes)).toContain(String(ADDED_NODE_ID))
  const matchingOpIds = [update, secondOpUpdate].flatMap((hostUpdate) => {
    if (hostUpdate === null) return []
    const opIds = hostUpdate.data.op_ids
    if (
      !Array.isArray(opIds) ||
      !opIds.every((opId): opId is string => typeof opId === 'string')
    ) {
      throw new Error('host update did not carry string op_ids')
    }
    return opIds
  })

  if (order === 'docUpdateBeforeToolCall') hostSocket.send(update)
  hostSocket.send({
    type: 'agent_tool_call',
    data: {
      tool_call_id: 'call-add-node',
      tool_name: 'add_node',
      status: 'success',
      duration_ms: 90,
      workflow_id: WORKFLOW_ID,
      op_ids: matchingOpIds,
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID
    }
  })
  hostSocket.send({
    type: 'agent_message_delta',
    data: {
      delta: 'Added a note to the canvas.',
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID
    }
  })
  hostSocket.send({
    type: 'agent_message_done',
    data: { thread_id: THREAD_ID, message_id: MESSAGE_ID, usage: null }
  })

  await expect(panel.getByRole('button', { name: SEND_LABEL })).toBeVisible()
  await expect(
    panel.getByRole('button', {
      name:
        order === 'docUpdateBeforeToolCall'
          ? enMessages.agent.worked
          : enMessages.agent.workedNotConfirmedOnCanvas,
      exact: true
    })
  ).toBeVisible()

  return {
    vueNodes,
    sendUnrelatedDocUpdate: () => {
      if (unrelatedUpdate) hostSocket.send(unrelatedUpdate)
    },
    sendDelayedDocUpdate: () => {
      if (order !== 'docUpdateBeforeToolCall') hostSocket.send(update)
    },
    sendSecondOpDocUpdate: () => {
      if (secondOpUpdate) hostSocket.send(secondOpUpdate)
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
      const workSummary = panel.getByRole('button', {
        name: enMessages.agent.workedNotConfirmedOnCanvas,
        exact: true
      })
      await workSummary.click()
      await expect(workSummary).toHaveAttribute('aria-expanded', 'true')

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
      await expect(
        panel.getByRole('button', {
          name: enMessages.agent.worked,
          exact: true
        })
      ).toBeVisible()
    })

    test('an unrelated doc_update does not settle the correlated tool call', async ({
      page
    }) => {
      const { vueNodes, sendUnrelatedDocUpdate, sendDelayedDocUpdate } =
        await driveThroughToolCallDone(page, 'toolCallBeforeDocUpdate', true)

      const panel = page.locator('#agent-panel-root')
      const workSummary = panel.getByRole('button', {
        name: enMessages.agent.workedNotConfirmedOnCanvas,
        exact: true
      })
      await workSummary.click()
      await expect(workSummary).toHaveAttribute('aria-expanded', 'true')

      const addNodeRow = panel
        .getByRole('listitem')
        .filter({ hasText: 'Add node' })
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toBeVisible()

      sendUnrelatedDocUpdate()
      await expect(
        vueNodes.getNodeLocator(String(UNRELATED_NODE_ID))
      ).toBeVisible()
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toBeVisible()
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toHaveCount(
        0
      )

      sendDelayedDocUpdate()
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toHaveCount(
        0
      )
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toBeVisible()
    })

    test('a multi-op tool call stays syncing until its final op reaches the canvas', async ({
      page
    }) => {
      const { vueNodes, sendDelayedDocUpdate, sendSecondOpDocUpdate } =
        await driveThroughToolCallDone(
          page,
          'toolCallBeforeDocUpdate',
          false,
          true
        )

      const panel = page.locator('#agent-panel-root')
      const workSummary = panel.getByRole('button', {
        name: enMessages.agent.workedNotConfirmedOnCanvas,
        exact: true
      })
      await workSummary.click()
      await expect(workSummary).toHaveAttribute('aria-expanded', 'true')

      const addNodeRow = panel
        .getByRole('listitem')
        .filter({ hasText: 'Add node' })
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toBeVisible()

      sendDelayedDocUpdate()
      await expect(vueNodes.getNodeLocator(String(ADDED_NODE_ID))).toBeVisible()
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toBeVisible()
      await expect(vueNodes.getNodeLocator(String(SECOND_NODE_ID))).toHaveCount(
        0
      )

      sendSecondOpDocUpdate()
      await expect(
        vueNodes.getNodeLocator(String(SECOND_NODE_ID))
      ).toBeVisible()
      await expect(addNodeRow.locator('[class*="loader-circle"]')).toHaveCount(
        0
      )
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
      const workSummary = panel.getByRole('button', {
        name: enMessages.agent.worked,
        exact: true
      })
      await workSummary.click()
      await expect(workSummary).toHaveAttribute('aria-expanded', 'true')

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
