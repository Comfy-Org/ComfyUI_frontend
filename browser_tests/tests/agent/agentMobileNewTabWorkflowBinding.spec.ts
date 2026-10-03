import { devices, expect, mergeTests } from '@playwright/test'
import type { Route } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

// PM-1933: a cloud mobile-web reporter said the agent "is disconnected from my
// workflow and gets lost", and the intake form's "what happened instead"
// answer was "Workflow is not selected or detected". The ticket left two
// readings open and asked for a mobile pass to separate them: (1) a real
// binding defect where the thread adopts a minted or restored workflow in
// preference to the user's selection, or (2) a designed mint that only reads
// as a defect on a phone, where the user cannot see which graph is held.
//
// Reading 1 is refuted by production telemetry and is not what this pins --
// see reports/jobs/op345-pm1933-mobilebinding.md in the in-app-agent program
// repo. What is pinned here is the contract that refutes it, at the reported
// viewport: on a phone the Agent follows the tab on screen, mints for it when
// that tab has no cloud id yet, never silently retargets to another saved
// workflow, and holds a hand-picked target across the following turn.
//
// It also pins the layout fact that makes reading 2 legible and that no spec
// covered: at 393 CSS px the docked panel is the whole viewport, so the
// workflow chip inside it is the user's only view of which graph is bound and
// the close control is the only way back to the canvas.
//
// Distinct from agentFirstTurnOnUnsavedTab.spec.ts, which pins the unbound
// first turn's payload at desktop width and stops there, and from
// agentNewChatTargetWorkflow.spec.ts, which pins picker retargeting without
// sending. Neither runs at a phone viewport and neither pins a hand-picked
// target surviving the next turn.
//
// Lands green on main: a regression guard for the binding contract, not a
// live repro.

const test = mergeTests(agentTest, workflowSelectionTest, webSocketFixture)

// The id agentWorkflowSelectionFixture assigns the first workflow it saves.
const SAVED_WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-000000000001'
// A workflow the account has never seen, standing in for a server-side mint.
const MINTED_WORKFLOW_ID = 'b3e5d7f9-1a2c-4d6e-8f01-2a3b4c5d6e7f'
const THREAD_ID = '59dbdbf7-ec7f-4a51-93b2-602668f3f1b4'

const FIRST_MESSAGE_ID = '5c7e1a2b-8d4f-4e93-a016-3b8c5d9e0f12'
const SECOND_MESSAGE_ID = '7a1c3e5d-2b4f-4068-9c13-5e7a9b0d1f24'

const SAVED_TAB = 'Unsaved Workflow'
const NEW_TAB = 'Unsaved Workflow (2)'
const FIRST_PROMPT = 'Optimise my workflow for speed'
const SECOND_PROMPT = 'Now reduce the step count'

// Android Chrome as reported: Pixel 5 is 393x851 CSS px against the reporter's
// 394x853, and the panel's layout breakpoints are the point. Top-level because
// a device descriptor carries `defaultBrowserType`, which Playwright refuses
// inside a describe group.
test.use({
  ...devices['Pixel 5'],
  hasTouch: true,
  connectWebSocketToServer: false
})

test.describe(
  'Agent workflow binding on cloud mobile web, opened from a new tab',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('follows the tab on screen rather than a saved workflow, and holds a hand-picked target across the next turn', async ({
      page,
      workflowSelection,
      getWebSocket
    }) => {
      test.setTimeout(60_000)

      const posted: AgentPostMessageRequest[] = []
      let nextAck: AgentTurnAccepted = {
        thread_id: THREAD_ID,
        message_id: FIRST_MESSAGE_ID,
        workflow_id: MINTED_WORKFLOW_ID
      }
      // Registered from the test body so it resolves ahead of the selection
      // fixture's thread-list route, which would otherwise answer the POST
      // with a list instead of an accepted turn.
      await page.route('**/api/agent/threads/*/messages', (route: Route) => {
        const request = route.request()
        if (request.method() !== 'POST') return route.fallback()
        posted.push(zAgentPostMessageRequest.parse(request.postDataJSON()))
        return route.fulfill({ ...jsonRoute(nextAck), status: 202 })
      })

      // The workflow chip is disabled while a turn is in flight, so a turn
      // that never ends would make "the binding survived the next turn"
      // untestable (and is itself what the reporter sat through: this thread
      // waited 101s and 121s for a first reply). Close each turn over the
      // socket the way the server would.
      const finishTurn = async (messageId: string): Promise<void> => {
        const socket = await getWebSocket()
        socket.send(
          JSON.stringify({
            type: 'agent_message_done',
            data: { message_id: messageId, thread_id: THREAD_ID }
          })
        )
      }

      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root
      const picker = agentPanel.workflowPicker
      const topbar = new Topbar(page)
      const newBlankTab = page.getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })

      await test.step('the account already has a saved workflow', async () => {
        await agentPanel.open()
        await agentPanel.chooseWorkflow(SAVED_TAB)
        await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
        workflowSelection.finishSave(true)
        await expect(picker).toHaveText(SAVED_TAB)
      })

      // Reading 2 says the user cannot tell which graph the agent holds on a
      // phone. The measurement behind that: the panel is the entire viewport,
      // so the canvas and the tab strip are gone while it is open and the chip
      // is the whole of what the user can see about the binding.
      await test.step('at a phone width the panel is the entire viewport', async () => {
        const viewport = page.viewportSize()
        expect(
          viewport,
          'the device descriptor must set a viewport'
        ).not.toBeNull()
        const box = await agentPanel.dockedPanel.boundingBox()
        expect(box, 'the docked panel must have a layout box').not.toBeNull()
        expect(
          box!.width,
          'the panel floor is wider than the reported viewport, so it fills it'
        ).toBe(viewport!.width)
        await expect(
          picker,
          'the chip is the only affordance naming the bound workflow at this width'
        ).toBeVisible()
        await expect(
          agentPanel.closeButton,
          'and the close control is the only way back to the canvas'
        ).toBeVisible()
      })

      await test.step('the user closes the panel to reach a new blank tab', async () => {
        await agentPanel.close()
        await newBlankTab.click()
        await expect(topbar.getActiveTab()).toHaveText(NEW_TAB)
      })

      await test.step('the user reopens the Agent and starts a chat on that tab', async () => {
        await agentPanel.open()
        await panel
          .getByRole('button', { name: enMessages.agent.newChat })
          .click()
        await expect(
          picker,
          'a new chat targets the tab on screen, not the account-saved workflow'
        ).toHaveText(NEW_TAB)
      })

      await test.step('the first turn names the tab on screen, not the saved workflow', async () => {
        await agentPanel.sendMessage(FIRST_PROMPT)
        await expect.poll(() => posted.length).toBe(1)
        expect(
          posted[0].workflow_id ?? null,
          'the blank tab has no cloud id yet, so the turn cannot name one'
        ).toBeNull()
        expect(
          posted[0].current_tab_unbound,
          'the turn must say a tab IS selected but unbound, not that none is'
        ).toBe(true)
        expect(
          posted[0].workflow_id ?? null,
          'the agent must not silently retarget the account-saved workflow'
        ).not.toBe(SAVED_WORKFLOW_ID)
      })

      await test.step('the minted workflow the server returns stays named in the chip', async () => {
        await finishTurn(FIRST_MESSAGE_ID)
        await expect(picker).toHaveText(NEW_TAB)
      })

      // PM-1933 acceptance scenario 2: "a hand-picked binding holds".
      await test.step('the user hand-picks the saved workflow from the chip', async () => {
        await expect(picker).toBeEnabled()
        await agentPanel.chooseWorkflow(SAVED_TAB)
        await expect(picker).toHaveText(SAVED_TAB)
      })

      await test.step('the next turn is still bound to that pick, with no re-selection', async () => {
        nextAck = {
          ...nextAck,
          message_id: SECOND_MESSAGE_ID,
          workflow_id: SAVED_WORKFLOW_ID
        }
        await agentPanel.sendMessage(SECOND_PROMPT)
        await expect.poll(() => posted.length).toBe(2)
        expect(
          posted[1].workflow_id,
          'the turn after a hand-pick must carry the workflow the user picked'
        ).toBe(SAVED_WORKFLOW_ID)
        expect(
          posted[1].current_tab_unbound,
          'a bound pick is not an unbound tab'
        ).toBeUndefined()
        await expect(
          picker,
          'the binding must survive the turn without a second hand-pick'
        ).toHaveText(SAVED_TAB)
      })
    })
  }
)
