import { expect, mergeTests } from '@playwright/test'
import type { Locator, WebSocketRoute } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { DOC_PROTOCOL_VERSION } from '@/workbench/extensions/agent/crdt/docFrameClient'

import {
  MESSAGE_DONE_EVENT,
  WORKFLOW_ID as BOUND_WORKFLOW_ID,
  agentTest,
  pushAgentEvent
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const FIRST_PROMPT = 'What is on my canvas?'
const SECOND_PROMPT = 'Describe the focused canvas.'

const PERMANENTLY_REFUSED_SUBSCRIBE = {
  type: 'doc_subscribed',
  data: {
    v: DOC_PROTOCOL_VERSION,
    workflow_id: BOUND_WORKFLOW_ID,
    ok: false,
    code: 'schema_version_mismatch'
  }
}

function parsePosted(raw: string | undefined): AgentPostMessageRequest {
  expect(raw, 'a message body must have been POSTed').toBeTruthy()
  const parsed: unknown = JSON.parse(raw ?? '{}')
  const result = zAgentPostMessageRequest.safeParse(parsed)
  expect(
    result.success,
    'posted message body must match the generated request schema'
  ).toBe(true)
  if (!result.success) throw new Error('Invalid posted message body')
  return result.data
}

function draftNodeCount(body: AgentPostMessageRequest): number {
  const nodes = body.draft?.content?.nodes
  expect(nodes, 'posted draft nodes must be an array').toEqual(
    expect.any(Array)
  )
  if (!Array.isArray(nodes)) throw new Error('Invalid posted draft nodes')
  return nodes.length
}

function refuseDocSubscribePermanently(ws: WebSocketRoute): void {
  ws.send(JSON.stringify(PERMANENTLY_REFUSED_SUBSCRIBE))
}

async function pushTurnDoneOnceTurnIsActive(
  userBubbles: Locator,
  renderedPrompts: string[],
  ws: WebSocketRoute
): Promise<void> {
  await expect(
    userBubbles,
    'the turn must already be the active one before the done frame is pushed'
  ).toHaveText(renderedPrompts)
  pushAgentEvent(ws, MESSAGE_DONE_EVENT)
}

async function expectTurnSettled(agentPanel: AgentPanel): Promise<void> {
  await expect(
    agentPanel.stopButton,
    'turn 1 must settle before turn 2 is composed, so the ack binding is in place'
  ).toHaveCount(0)
  await expect(agentPanel.composer).toHaveText('')
}

test.describe(
  'Agent bound-canvas read path (QA sweep GM-12)',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('second turn on a bound populated tab carries the binding and withholds the draft', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      getAgentSocket
    }) => {
      test.setTimeout(45_000)

      const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
      expect(
        nodeCount,
        'fixture canvas must be populated'
      ).toBeGreaterThanOrEqual(3)

      await agentPanel.open()
      const userBubbles = agentPanel.root.getByTestId('user-message-bubble')
      const ws = await getAgentSocket()

      await test.step('turn 1 on an unbound tab carries the canvas inline', async () => {
        await agentPanel.sendMessage(FIRST_PROMPT)
        await expect.poll(() => postedMessages.length).toBe(1)
        const first = parsePosted(postedMessages[0])
        expect(first.workflow_id).toBeUndefined()
        expect(
          draftNodeCount(first),
          'turn 1 draft must carry the populated graph'
        ).toBe(nodeCount)
      })

      await test.step('the ack binds the tab and the turn settles', async () => {
        await pushTurnDoneOnceTurnIsActive(userBubbles, [FIRST_PROMPT], ws)
        await expectTurnSettled(agentPanel)
      })

      const second =
        await test.step('turn 2 is composed on the same bound tab', async () => {
          await agentPanel.sendMessage(SECOND_PROMPT)
          await expect.poll(() => postedMessages.length).toBe(2)
          return parsePosted(postedMessages[1])
        })

      expect(second.workflow_id, 'binding from turn 1 ack must be sent').toBe(
        BOUND_WORKFLOW_ID
      )
      expect(
        second.current_tab_unbound,
        'a bound tab must not be reported as unbound'
      ).toBeFalsy()
      expect(
        second.open_tabs?.map((t) => t.workflow_id),
        'open_tabs must include the bound id'
      ).toContain(BOUND_WORKFLOW_ID)
      expect(
        second.draft,
        'a bound tab whose document the follower owns must not seed a draft over it'
      ).toBeUndefined()
    })

    test('switching to a new tab and back keeps the next turn pointed at the bound tab', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      getAgentSocket
    }) => {
      test.setTimeout(45_000)

      const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
      expect(nodeCount).toBeGreaterThanOrEqual(3)

      await agentPanel.open()
      const userBubbles = agentPanel.root.getByTestId('user-message-bubble')
      const ws = await getAgentSocket()

      await agentPanel.sendMessage(FIRST_PROMPT)
      await expect.poll(() => postedMessages.length).toBe(1)
      await pushTurnDoneOnceTurnIsActive(userBubbles, [FIRST_PROMPT], ws)
      await expectTurnSettled(agentPanel)

      await test.step('user opens a fresh empty tab, then returns to the bound one', async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBeLessThan(nodeCount)
        await comfyPage.menu.topbar.getTab(0).click()
        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(nodeCount)
      })

      await agentPanel.sendMessage(SECOND_PROMPT)
      await expect.poll(() => postedMessages.length).toBe(2)
      const second = parsePosted(postedMessages[1])

      expect(second.workflow_id).toBe(BOUND_WORKFLOW_ID)
      expect(second.current_tab_unbound).toBeFalsy()
      expect(second.open_tabs?.map((tab) => tab.workflow_id)).toContain(
        BOUND_WORKFLOW_ID
      )
      expect(
        second.draft,
        'a tab detour must not make the turn seed a draft over the bound document'
      ).toBeUndefined()
    })

    test('second turn still carries the populated graph when the follower is refused the bound document', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      getAgentSocket
    }) => {
      test.setTimeout(45_000)

      const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
      expect(nodeCount).toBeGreaterThanOrEqual(3)

      await agentPanel.open()
      const userBubbles = agentPanel.root.getByTestId('user-message-bubble')
      const ws = await getAgentSocket()

      await agentPanel.sendMessage(FIRST_PROMPT)
      await expect.poll(() => postedMessages.length).toBe(1)
      await pushTurnDoneOnceTurnIsActive(userBubbles, [FIRST_PROMPT], ws)
      await expectTurnSettled(agentPanel)

      await test.step('the host permanently refuses the bound document and the user is told', async () => {
        refuseDocSubscribePermanently(ws)
        await expect(
          comfyPage.toast.withText(enMessages.agent.workflowSyncFailedTitle)
        ).toHaveCount(1)
        await comfyPage.toast.closeToasts()
      })

      await agentPanel.sendMessage(SECOND_PROMPT)
      await expect.poll(() => postedMessages.length).toBe(2)
      const second = parsePosted(postedMessages[1])

      expect(second.workflow_id).toBe(BOUND_WORKFLOW_ID)
      expect(
        draftNodeCount(second),
        'a refused follower owns nothing, so the turn must carry the populated graph or the agent reads an empty canvas'
      ).toBe(nodeCount)
    })
  }
)
