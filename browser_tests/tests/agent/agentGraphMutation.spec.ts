import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import {
  BUILD_VIDEO_GRAPH_TOOL_EVENT,
  GRAPH_SUBSCRIBED_EVENT,
  GRAPH_UPDATE_EVENT,
  MESSAGE_DONE_EVENT,
  VIDEO_GRAPH_DONE_EVENT,
  VIDEO_GRAPH_DONE_TEXT,
  agentTest,
  pushAgentEvent
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'In-App Agent graph mutations',
  {
    tag: ['@cloud', '@canvas', '@node', '@vue-nodes']
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test('GM-96 / PM-921 does not present an uncommitted build as finished', async ({
      agentPanel,
      postedMessages,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Build a Wan 2.2 two-stage video graph')
      await expect.poll(() => postedMessages.length).toBe(1)

      pushAgentEvent(ws, BUILD_VIDEO_GRAPH_TOOL_EVENT)
      pushAgentEvent(ws, VIDEO_GRAPH_DONE_EVENT)
      pushAgentEvent(ws, MESSAGE_DONE_EVENT)
      await expect(agentPanel.workSummary).toBeVisible()

      test.fail(
        true,
        'PM-921: the agent reports a build that was not committed'
      )
      await expect(
        agentPanel.root.getByText(VIDEO_GRAPH_DONE_TEXT)
      ).toBeHidden()
    })

    test('materializes a committed graph node on the canvas', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const clientFrames: string[] = []
      ws.onMessage((message) => clientFrames.push(message.toString()))

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Build a graph')
      await expect.poll(() => postedMessages.length).toBe(1)
      await expect
        .poll(() =>
          clientFrames.some((frame) => frame.includes('"type":"doc_subscribe"'))
        )
        .toBe(true)

      ws.send(JSON.stringify(GRAPH_SUBSCRIBED_EVENT))
      ws.send(JSON.stringify(GRAPH_UPDATE_EVENT))
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Agent-created node')
      ).toBeVisible()
    })
  }
)
