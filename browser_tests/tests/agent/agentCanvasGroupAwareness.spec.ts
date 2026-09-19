import { expect, mergeTests } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  MESSAGE_DELTA_EVENT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

const GROUP_TITLE = 'Toolbar Swatch Group'

// The reply below stands in for the transcript PM-926 recorded against the
// deployed product ("A group titled 'Sampling' is in the document and drawn
// on screen, but the agent's reply states there are no group boxes on the
// canvas"). It is not code this repo can fix: the root cause is server-side
// — comfy-cli's `render_py` (the renderer behind cloud's `print_workflow` /
// `read_workflow` agent tools) only reads `workflow["nodes"]` and
// `workflow["links"]`, never `workflow["groups"]`, so the agent's one text
// view of the canvas omits groups entirely (see
// https://github.com/Comfy-Org/comfy-cli/pull/896, which pins that at the
// renderer level). Once that is fixed, replace this spec with a real
// recorded conversation fixture (browser_tests/fixtures/data/agent/README.md)
// instead of just flipping the assertion, since a hand-authored reply proves
// nothing about production LLM behavior.
const DELTA_IDS = MESSAGE_DELTA_EVENT.data as {
  message_id: string
  thread_id: string
}

const OBSERVED_BUGGY_REPLY_EVENT: AgentWsEvent = {
  type: 'agent_message_delta',
  data: {
    ...DELTA_IDS,
    delta: 'There are no group boxes on the canvas.'
  }
}

test.describe('Agent canvas group awareness', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('groups/two_groups')
  })

  // PM-907 (child: PM-926): the agent's canvas read enumerates nodes/links
  // but drops groups and frames entirely, so it wrongly reports that a
  // visible, titled group does not exist.
  test('reports a canvas group visible in the document when asked about it', async ({
    agentPanel,
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    test.setTimeout(30_000)

    // Structure first, while a failure here is still unexpected: the fixture
    // really does put a titled group on the canvas.
    const groupTitles = await comfyPage.page.evaluate(() =>
      window.app!.graph.groups.map((g) => g.title)
    )
    expect(groupTitles).toContain(GROUP_TITLE)

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const sendButton = panel.getByRole('button', { name: 'Send' })
    await composer.fill('Are there any groups on the canvas?')

    const ws = await getWebSocket()
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

    // Below is the known defect: the (mocked) reply mirrors what the
    // deployed product actually returned in PM-926's transcript, and the
    // group visibly present on the canvas above is never mentioned.
    test.fail()
    pushEvent(ws, OBSERVED_BUGGY_REPLY_EVENT)
    await expect(panel.getByText(GROUP_TITLE)).toBeVisible()
  })
})
