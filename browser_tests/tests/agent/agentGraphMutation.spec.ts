import type { Page, WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  BUILD_VIDEO_GRAPH_TOOL_EVENT,
  MESSAGE_DONE_EVENT,
  VIDEO_GRAPH_DONE_EVENT,
  VIDEO_GRAPH_DONE_TEXT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const BUILD_PROMPT = 'Build a Wan 2.2 two-stage video graph'

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

/**
 * Graph-mutation QA cases (GM-*) from the 2026-09-05 in-house eval. The
 * zero-nodes build report is GM-96 / GM-99, tracked as PM-921.
 *
 * `agent_tool_call` is a transcript event: it renders a tool row and never
 * reaches the graph. Mutations travel the CRDT path instead — doc frames on the
 * same `/ws` connection, through `docFrameClient` to `agentNodeMaterializer`.
 * The `add_node` in a tool-call event and the `add_node` in the op vocabulary
 * (`crdt/graphOperations.ts`) are unrelated things sharing a name, so a
 * successful tool call is not evidence that anything was committed. These cases
 * drive the shape the eval captured: a turn that reports a finished build while
 * delivering no doc frames.
 */
test.describe('In-App Agent graph mutations', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  async function runUncommittedBuildTurn(
    page: Page,
    ws: WebSocketRoute,
    postedMessages: string[]
  ) {
    const panel = page.locator('#agent-panel-root')
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })

    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(panel).toBeVisible()

    await composer.fill(BUILD_PROMPT)
    await panel.getByRole('button', { name: 'Send' }).click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)
    expect(postedMessages[0]).toContain(BUILD_PROMPT)
    await expect(composer).toHaveValue('')

    pushEvent(ws, BUILD_VIDEO_GRAPH_TOOL_EVENT)
    await expect(
      panel.getByRole('button', { name: 'Ran 1 tool call for 2.1 seconds' })
    ).toBeVisible()

    pushEvent(ws, VIDEO_GRAPH_DONE_EVENT)
    await expect(panel.getByText(VIDEO_GRAPH_DONE_TEXT)).toBeVisible()

    // Settle the turn so the node count is not read against an in-flight apply.
    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)

    return panel
  }

  test('GM-96 / PM-921 leaves the canvas empty when a build turn commits no graph operations', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    await comfyPage.nodeOps.clearGraph()
    expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    const ws = await getWebSocket()
    await runUncommittedBuildTurn(comfyPage.page, ws, postedMessages)

    expect(
      await comfyPage.nodeOps.getGraphNodesCount(),
      'a tool-call transcript event must not mutate the graph on its own'
    ).toBe(0)
  })

  test('GM-96 / PM-921 does not present an uncommitted build as finished', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    test.fixme(
      true,
      'PM-921: the panel renders the completion copy verbatim and has no affordance for a build the agent claimed but never committed. The affordance is undesigned — see the PR Review Focus before implementing.'
    )

    await comfyPage.nodeOps.clearGraph()

    const ws = await getWebSocket()
    const panel = await runUncommittedBuildTurn(
      comfyPage.page,
      ws,
      postedMessages
    )

    expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    await expect(
      panel.getByTestId('agent-uncommitted-build-notice')
    ).toBeVisible()
  })
})
