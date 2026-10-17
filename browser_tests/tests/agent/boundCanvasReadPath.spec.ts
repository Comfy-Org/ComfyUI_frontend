import { expect, mergeTests } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import { webSocketFixture } from '@e2e/fixtures/ws'

import {
  MESSAGE_DONE_EVENT,
  agentTest,
  pushAgentEvent
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

/** Must match WORKFLOW_ID in agentPanelMocks (the id the turn ack binds). */
const BOUND_WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

const FIRST_PROMPT = 'What is on my canvas?'
const SECOND_PROMPT = 'Describe the focused canvas.'

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

/**
 * Regression coverage for the "focused canvas is empty" read-path failure
 * (QA sweep GM-12): a populated workflow whose tab has been bound to a cloud
 * workflow id by the first turn ack must still tell the agent *which* graph to
 * read on the next turn, otherwise the agent reads an empty graph.
 *
 * The first (unbound) turn carries the canvas inline as a draft. The second
 * turn deliberately does not: the follower owns the bound document by then, so
 * the binding — not a draft — is what identifies the graph. See
 * `followerOwnsDocument` in `AgentPanelRoot.vue` (#17469), which withholds a
 * draft the backend would otherwise apply unconditionally over a live
 * document. Asserting a populated turn-2 draft here would pin the pre-#17469
 * read path and re-license that clobber.
 */
test.describe('Agent bound-canvas read path', { tag: '@cloud' }, () => {
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

    // Turn 1: unbound temporary tab. The 202 ack binds the tab to
    // BOUND_WORKFLOW_ID (AgentPanelRoot.onWorkflowAdopted).
    await agentPanel.composer.fill(FIRST_PROMPT)
    await agentPanel.sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(1)
    const first = parsePosted(postedMessages[0])
    expect(first.workflow_id).toBeUndefined()
    expect(
      draftNodeCount(first),
      'turn 1 draft must carry the populated graph'
    ).toBeGreaterThanOrEqual(3)

    // Seeing the POST is not enough to push the done frame: the turn must
    // already be the active one or agentConversationStore.ingest drops the
    // frame with no retry, and the composer clears on submit so clearing
    // proves nothing. The user bubble is the first rendered signal that
    // activeTurnId is set (see agentTurnLockFixture.startTurn).
    await expect(userBubbles).toHaveText([FIRST_PROMPT])
    pushAgentEvent(ws, MESSAGE_DONE_EVENT)

    // Turn 1 must actually settle before turn 2 is composed, otherwise the
    // binding the ack applied may not be in place when the next POST is built.
    await expect(agentPanel.stopButton).toHaveCount(0)
    await expect(agentPanel.composer).toHaveText('')

    // Turn 2: same thread, same (now bound) tab, canvas unchanged. Send is
    // disabled while the composer is empty, so it can only be asserted
    // enabled after the prompt is in.
    await agentPanel.composer.fill(SECOND_PROMPT)
    await expect(agentPanel.sendButton).toBeEnabled()
    await agentPanel.sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(2)
    const second = parsePosted(postedMessages[1])

    expect(second.workflow_id, 'binding from turn 1 ack must be sent').toBe(
      BOUND_WORKFLOW_ID
    )
    // Which tab the turn is about is carried by `workflow_id` plus
    // `current_tab_unbound`, not by `current_tab`. PM-1847 (`37f8246743`) made
    // that pair the contract because a turn with neither reads server-side as
    // "no tab selected"; `openTabsSnapshot` has not populated `current_tab`
    // since. A bound tab is identifiable, so the unbound flag must be absent.
    expect(
      second.current_tab_unbound,
      'a bound tab must not be reported as unbound'
    ).toBeFalsy()
    expect(
      second.open_tabs?.map((t) => t.workflow_id),
      'open_tabs must include the bound id'
    ).toContain(BOUND_WORKFLOW_ID)
    // ...and must NOT re-send the canvas inline. Once the tab is bound, the
    // follower owns that document, so `AgentPanelRoot.targetWorkflowDraft`
    // withholds the draft (`followerOwnsDocument`, #17469): the backend
    // applies a versionless draft unconditionally, so seeding one over a live
    // document would overwrite edits the canvas has not caught up with.
    expect(
      second.draft,
      'a bound tab must not seed a draft over the live document'
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

    await agentPanel.composer.fill(FIRST_PROMPT)
    await agentPanel.sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(1)
    await expect(userBubbles).toHaveText([FIRST_PROMPT])
    pushAgentEvent(ws, MESSAGE_DONE_EVENT)
    await expect(agentPanel.stopButton).toHaveCount(0)
    await expect(agentPanel.composer).toHaveText('')

    // Open a fresh (empty, unbound) tab, then return to the bound one.
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBeLessThan(nodeCount)
    await comfyPage.menu.topbar.getTab(0).click()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(nodeCount)

    await agentPanel.composer.fill(SECOND_PROMPT)
    await expect(agentPanel.sendButton).toBeEnabled()
    await agentPanel.sendButton.click()
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
})
