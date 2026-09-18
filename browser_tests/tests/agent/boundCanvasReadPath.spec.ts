import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { MESSAGE_DONE_EVENT, agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

/** Must match WORKFLOW_ID in agentPanelMocks (the id the turn ack binds). */
const BOUND_WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

interface PostedMessageBody {
  workflow_id?: string
  current_tab?: string
  open_tabs?: { workflow_id: string; name: string }[]
  draft?: { content?: { nodes?: unknown[] } }
}

function parsePosted(raw: string | undefined): PostedMessageBody {
  expect(raw, 'a message body must have been POSTed').toBeTruthy()
  return JSON.parse(raw ?? '{}') as PostedMessageBody
}

/**
 * Regression coverage for the "focused canvas is empty" read-path failure
 * (QA sweep GM-12): a populated workflow whose tab has been bound to a cloud
 * workflow id by the first turn ack must be sent on the next turn with both
 * the binding and a populated draft, otherwise the agent reads an empty graph.
 */
test.describe('Agent bound-canvas read path', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test.beforeEach(async ({ comfyPage }) => {
    // Cloud workflow index used to resolve saved tabs to ids; none saved here.
    await comfyPage.page.route('**/api/agent/workflows**', (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
        })
      )
    )
  })

  test('second turn on a bound populated tab carries the binding and a populated draft', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    test.setTimeout(45_000)

    const page = comfyPage.page
    const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(
      nodeCount,
      'fixture canvas must be populated'
    ).toBeGreaterThanOrEqual(3)

    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const sendButton = panel.getByRole('button', { name: 'Send' })
    const ws = await getWebSocket()

    // Turn 1: unbound temporary tab. The 202 ack binds the tab to
    // BOUND_WORKFLOW_ID (AgentPanelRoot.onWorkflowAdopted).
    await composer.fill('What is on my canvas?')
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(1)
    const first = parsePosted(postedMessages[0])
    expect(first.workflow_id).toBeUndefined()
    expect(
      first.draft?.content?.nodes?.length,
      'turn 1 draft must carry the populated graph'
    ).toBeGreaterThanOrEqual(3)

    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(composer).toHaveValue('')

    // Turn 2: same thread, same (now bound) tab, canvas unchanged.
    await composer.fill('Describe the focused canvas.')
    await expect(sendButton).toBeEnabled()
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(2)
    const second = parsePosted(postedMessages[1])

    expect(second.workflow_id, 'binding from turn 1 ack must be sent').toBe(
      BOUND_WORKFLOW_ID
    )
    expect(second.current_tab, 'current_tab must point at the bound id').toBe(
      BOUND_WORKFLOW_ID
    )
    expect(
      second.open_tabs?.map((t) => t.workflow_id),
      'open_tabs must include the bound id'
    ).toContain(BOUND_WORKFLOW_ID)
    expect(
      second.draft?.content?.nodes?.length,
      'turn 2 draft must still carry the populated graph (GM-12: reads empty)'
    ).toBeGreaterThanOrEqual(nodeCount)
  })

  test('switching to a new tab and back keeps the bound tab populated on the next turn', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    test.setTimeout(45_000)

    const page = comfyPage.page
    const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(nodeCount).toBeGreaterThanOrEqual(3)

    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    const panel = page.locator('#agent-panel-root')
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const sendButton = panel.getByRole('button', { name: 'Send' })
    const ws = await getWebSocket()

    await composer.fill('What is on my canvas?')
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(1)
    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(composer).toHaveValue('')

    // Open a fresh (empty, unbound) tab, then return to the bound one.
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBeLessThan(nodeCount)
    await comfyPage.menu.topbar.getTab(0).click()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(nodeCount)

    await composer.fill('Describe the focused canvas.')
    await expect(sendButton).toBeEnabled()
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(2)
    const second = parsePosted(postedMessages[1])

    expect(second.workflow_id).toBe(BOUND_WORKFLOW_ID)
    expect(second.current_tab).toBe(BOUND_WORKFLOW_ID)
    expect(
      second.draft?.content?.nodes?.length,
      'draft after tab switch must reflect the bound populated tab'
    ).toBeGreaterThanOrEqual(nodeCount)
  })
})
