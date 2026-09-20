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

// PM-907 (child: PM-926) traced to comfy-cli's `render_py` — the renderer
// behind cloud's `print_workflow` / `read_workflow` agent tools — which only
// read `workflow["nodes"]` and `workflow["links"]`, never
// `workflow["groups"]`, so the agent's one text view of the canvas omitted
// groups entirely and it would confidently report none exist even when one
// is drawn on screen with a title bar. No frontend code path was involved:
// the frontend already serializes canvas groups correctly
// (`window.app.graph.groups`, asserted below).
//
// The fix landed server-side in
// https://github.com/Comfy-Org/comfy-cli/pull/896, which now renders each
// group as a `# group <id> "<title>": nodes <a>, <b>` comment in the
// printed source. The reply below stands in for what an agent grounded in
// that corrected source now says, in place of the previously observed
// defective reply ("There are no group boxes on the canvas.") that this
// spec pinned as `test.fail()` before the fix landed. A hand-authored mock
// still can't prove anything about production LLM behavior on its own, so
// this should eventually be replaced by a real recorded conversation
// fixture (browser_tests/fixtures/data/agent/README.md) once one is
// captured against the fixed backend.
const DELTA_IDS = MESSAGE_DELTA_EVENT.data as {
  message_id: string
  thread_id: string
}

const GROUP_AWARE_REPLY_EVENT: AgentWsEvent = {
  type: 'agent_message_delta',
  data: {
    ...DELTA_IDS,
    delta: `Yes — there's a group titled "${GROUP_TITLE}" on the canvas.`
  }
}

test.describe('Agent canvas group awareness', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('groups/two_groups')
  })

  // PM-907 (child: PM-926): the agent's canvas read now enumerates canvas
  // groups (comfy-cli#896), so it can report a visible, titled group
  // instead of wrongly asserting none exist.
  test('reports a canvas group visible in the document when asked about it', async ({
    agentPanel,
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    test.setTimeout(30_000)

    // Structure first: the fixture really does put a titled group on the
    // canvas, which the frontend already serializes correctly.
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

    // The reply now mentions the group the agent's fixed canvas read can
    // see, and the panel renders it — the toggle this spec used to fail on.
    pushEvent(ws, GROUP_AWARE_REPLY_EVENT)
    await expect(panel.getByText(GROUP_TITLE)).toBeVisible()
  })
})
