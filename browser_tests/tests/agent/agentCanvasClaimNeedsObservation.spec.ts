import { mergeTests, expect } from '@playwright/test'
import type { Page, WebSocketRoute } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  BLANK_WORKFLOW,
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

/**
 * PM-1343, PM-1996 and PM-1586 are one failure seen from three angles: the
 * agent claims success while the canvas is empty or unchanged. PM-1586 took
 * five merged PRs and came back in production on 2026-10-03, which is what
 * three more per-symptom fixes would do again.
 *
 * THE INVARIANT THIS FILE PINS. The panel may present a canvas-affecting
 * claim as settled only while showing a canvas state it has actually
 * observed: a canvas-mutating tool call renders as unconfirmed, never as
 * succeeded, until a live document frame for the bound tab has applied, and
 * an empty bound tab is stated as empty rather than left to the turn's prose
 * to describe.
 *
 * Why the claim cannot be fixed in the agent's prose, which is where the
 * first five attempts aimed. The cloud system prompt
 * (`services/agent/internal/loop/prompt.go`) ALREADY carries both of the
 * requirements as rules — "END-OF-TURN COMPLETION CHECK … compare every
 * requested step … with what actually landed in the graph", "DONE MEANS
 * WIRED THROUGH … existence on the canvas is not completion", and a
 * READ-CURRENT-STATE-FIRST rule whose own worked example is the user saying
 * "where is the workflow? I see an empty canvas". The reported turn broke all
 * three: Christian's trace has the agent KNOW the tab was empty, make no
 * edit, then say the nodes were ready and offer export/save. A sixth rule
 * addressed to the model is not an enforcement mechanism, so the contract
 * lives here, in the browser, where the canvas can be looked at.
 *
 * Both cases below are **server-success** turns. Every chat frame reports
 * `status: 'success'`, exactly as the PM-2047 incident found ("every write
 * returned draft_committed=true and the next turn still started at zero"), so
 * nothing here is testing a failure the server already knows about.
 */

const WORKFLOW_ID = 'b7c6d5e4-3f2a-41b0-9c8d-7e6f5a4b3c2d'
const THREAD_ID = 'a1b2c3d4-e5f6-4071-8293-a4b5c6d7e8f9'
const MESSAGE_ID = 'd4c3b2a1-f6e5-4170-9382-f9e8d7c6b5a4'
const ADDED_NODE_ID = 7331

const COPY = enMessages.agent

function chat(frame: AgentWsEvent): string {
  return JSON.stringify(frame)
}

function toolCall(name: string, callId: string): string {
  return chat({
    type: 'agent_tool_call',
    data: {
      tool_call_id: callId,
      tool_name: name,
      status: 'success',
      duration_ms: 120,
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID
    }
  })
}

/** The turn's own closing claim, in the words the reports quote. */
function completionClaim(text: string): string[] {
  return [
    chat({
      type: 'agent_message_delta',
      data: { delta: text, thread_id: THREAD_ID, message_id: MESSAGE_ID }
    }),
    chat({
      type: 'agent_message_done',
      data: { thread_id: THREAD_ID, message_id: MESSAGE_ID, usage: null }
    })
  ]
}

/**
 * Boots the agent-enabled app on an empty canvas, binds the panel to that
 * tab, and waits for the follower's `doc_subscribe` to go out. Returns the
 * socket so each case can decide what the doc surface does next — which is
 * the only thing that differs between them.
 */
async function bootOnEmptyBoundTab(
  page: Page,
  getWebSocket: () => Promise<WebSocketRoute>
): Promise<{ socket: WebSocketRoute; panel: AgentPanel }> {
  await page.setViewportSize({ width: 1920, height: 1280 })
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
  })
  await bootAgentApp(page, true, {
    settings: { 'Comfy.VueNodes.Enabled': true },
    beforeNavigate: async (page) => {
      await mockAgentTurnApi(page, {
        message_id: MESSAGE_ID,
        thread_id: THREAD_ID,
        workflow_id: WORKFLOW_ID
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)
    }
  })
  await loadIntoBootWorkflow(page, BLANK_WORKFLOW)

  const socket = await getWebSocket()
  const outbound: string[] = []
  socket.onMessage((message) => outbound.push(String(message)))

  const panel = new AgentPanel(page)
  await panel.open()
  await panel.selectWorkflow()
  await panel.sendMessage('Build me a text-to-image workflow.')

  await expect
    .poll(() => outbound.join('\n') || '(nothing outbound)', {
      timeout: 15_000
    })
    .toContain('doc_subscribe')

  // The premise of every case here: the canvas starts with nothing on it.
  await expect
    .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
    .toBe(0)

  return { socket, panel }
}

test.describe(
  'the agent may not claim a canvas it has not been observed to change',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 90_000 })
    // This file is the host: every doc frame below is sent by hand, so the
    // route must not also dial the real backend. Without this the `/ws`
    // handshake answers 403, no frame is ever routed, and the `doc_subscribe`
    // wait in `bootOnEmptyBoundTab` times out on an empty outbound log.
    test.use({ connectWebSocketToServer: false })

    /**
     * PM-1343 / PM-1586. The doc surface refuses the subscription, which is
     * the production state the earlier gate could not express: a
     * `doc_update` is the only route by which an agent write reaches this
     * canvas, so the refusal makes confirmation IMPOSSIBLE rather than late.
     * The old gate read `crdtStatus.connected` as a boolean and therefore
     * skipped its own check in exactly that state, flipping the tool call to
     * a settled success glyph over an empty canvas.
     *
     * Red on the parent at the summary assertion: every preceding checkpoint
     * is green there — the turn runs, the tool reports success, the canvas is
     * correctly empty — and the panel heads the turn "Worked".
     */
    test('a completion claim is not emitted for a write the canvas never took', async ({
      page,
      getWebSocket
    }) => {
      const { socket } = await bootOnEmptyBoundTab(page, getWebSocket)
      const host = new HostDoc(
        WORKFLOW_ID,
        { nodes: [], links: [] },
        { types: {} }
      )

      // `unsupported`: the doc surface is off for this deployment. A real,
      // permanent refusal the lifecycle stops retrying — not a flake, and
      // not a schema concern (that path is fixed and deployed elsewhere).
      const refusal = host.subscribeRefused('doc surface disabled')
      socket.send(
        JSON.stringify({
          ...refusal,
          data: { ...refusal.data, code: 'unsupported' }
        })
      )

      // The turn then does what PM-2047 measured: reports the write a
      // success and narrates completion.
      socket.send(toolCall('add_node', 'call-add-node'))
      for (const frame of completionClaim(
        'Done — your nodes are ready on the canvas.'
      ))
        socket.send(frame)

      const root = page.locator('#agent-panel-root')

      // The composer is free again, so the turn really has finished: this is
      // the settled end state the person is left looking at, not a race.
      await expect(root.getByRole('button', { name: COPY.send })).toBeVisible()

      // THE ASSERTION. The turn's own headline is the panel's voice, and it
      // must not say the work is done. Pre-fix this read "Worked".
      await expect(
        root.getByRole('button', {
          name: COPY.workedNotConfirmedOnCanvas
        })
      ).toBeVisible()
      await expect(root.getByRole('button', { name: /^Worked$/ })).toHaveCount(
        0
      )

      // And one level down, the tool call itself: not a settled success.
      await root
        .getByRole('button', { name: COPY.workedNotConfirmedOnCanvas })
        .click()
      await expect(
        root.getByRole('listitem').filter({ hasText: /not confirmed/i })
      ).toBeVisible()

      // The gate is NOT relaxed in the other direction either: nothing is
      // invented onto the canvas to make the claim true.
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(0)
      await expect(
        page.locator(`[data-node-id="${ADDED_NODE_ID}"]`)
      ).toHaveCount(0)
    })

    /**
     * PM-1996, and it is the half a per-symptom fix misses. Christian's trace
     * has the agent perform NO edit at all after a tab switch, so there is no
     * failed write to flag — it simply describes a workflow that is not
     * there and offers to export and save it, pointing at a hamburger menu
     * the app does not have. Nothing about the turn's own frames is wrong, so
     * the only thing that can contradict it is the canvas.
     *
     * Red on the parent: no empty-canvas statement exists anywhere in the
     * panel, so the guidance stands unchallenged.
     */
    test('export and save guidance is contradicted on an empty tab', async ({
      page,
      getWebSocket
    }) => {
      const { socket } = await bootOnEmptyBoundTab(page, getWebSocket)
      const host = new HostDoc(
        WORKFLOW_ID,
        { nodes: [], links: [] },
        { types: {} }
      )

      // A healthy doc surface, deliberately: this case is not about delivery
      // at all. The document is subscribed, synced, and empty.
      for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))

      // The turn reads the tab and writes nothing — `print_workflow` is a
      // read-only tool and is correctly outside the confirmation contract.
      socket.send(toolCall('print_workflow', 'call-print'))
      for (const frame of completionClaim(
        'Your nodes are ready. To keep this workflow, open the hamburger menu ' +
          'in the top left and choose Export, or Save to store it in your account.'
      ))
        socket.send(frame)

      const root = page.locator('#agent-panel-root')
      await expect(root.getByRole('button', { name: COPY.send })).toBeVisible()

      // THE ASSERTION. The panel states the canvas is empty and that there
      // is nothing here to run, save or export, beside the turn that just
      // said the opposite.
      const notice = root.getByTestId('agent-run-notice-emptyCanvas')
      await expect(notice).toBeVisible()
      await expect(notice).toContainText(COPY.canvasIsEmptyAfterTurn)

      // The read-only tool call is not slandered on the way: this turn
      // claimed no write, so no row warns about one.
      await expect(
        root.getByRole('button', {
          name: COPY.workedNotConfirmedOnCanvas
        })
      ).toHaveCount(0)
    })

    /**
     * The other direction of the same invariant, and the reason this is a
     * contract rather than a warning banner: when the canvas IS observed to
     * change, nothing above fires. Without this, "always say unconfirmed"
     * would pass the two cases above and be worthless.
     */
    test('a write the canvas did take reads as done, with no notice', async ({
      page,
      getWebSocket
    }) => {
      const { socket } = await bootOnEmptyBoundTab(page, getWebSocket)
      const host = new HostDoc(
        WORKFLOW_ID,
        { nodes: [], links: [] },
        { types: { MarkdownNote: { widget_order: ['text'] } } }
      )
      for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))

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
            widgets_values: ['landed']
          },
          node_id: ADDED_NODE_ID,
          class_type: 'MarkdownNote'
        }
      ])
      socket.send(JSON.stringify(update))
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(1)

      socket.send(toolCall('add_node', 'call-add-node'))
      for (const frame of completionClaim('Added a note to the canvas.'))
        socket.send(frame)

      const root = page.locator('#agent-panel-root')
      await expect(root.getByRole('button', { name: COPY.send })).toBeVisible()
      await expect(root.getByRole('button', { name: /^Worked/ })).toBeVisible()
      await expect(
        root.getByRole('button', {
          name: COPY.workedNotConfirmedOnCanvas
        })
      ).toHaveCount(0)
      await expect(
        root.getByTestId('agent-run-notice-emptyCanvas')
      ).toHaveCount(0)
    })
  }
)
