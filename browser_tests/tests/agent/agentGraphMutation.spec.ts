import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  BUILD_VIDEO_GRAPH_TOOL_EVENT,
  GRAPH_SUBSCRIBED_EVENT,
  GRAPH_UPDATE_EVENT,
  MESSAGE_DONE_EVENT,
  VIDEO_GRAPH_DONE_EVENT,
  VIDEO_GRAPH_DONE_TEXT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'In-App Agent graph mutations',
  {
    tag: ['@cloud', '@canvas', '@node']
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test('GM-96 / PM-921 does not present an uncommitted build as finished', async ({
      comfyPage,
      postedMessages,
      getWebSocket
    }) => {
      const page = comfyPage.page
      const ws = await getWebSocket()
      const panel = page.locator('#agent-panel-root')
      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      await panel
        .getByRole('textbox', { name: /^Describe ideas/ })
        .fill('Build a Wan 2.2 two-stage video graph')
      await panel.getByRole('button', { name: 'Send' }).click()
      await expect.poll(() => postedMessages.length).toBe(1)

      ws.send(JSON.stringify(BUILD_VIDEO_GRAPH_TOOL_EVENT))
      await expect(
        panel.getByRole('button', { name: 'Ran 1 tool call for 2.1 seconds' })
      ).toBeVisible()
      ws.send(JSON.stringify(VIDEO_GRAPH_DONE_EVENT))
      ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
      await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()

      test.fail(
        true,
        'PM-921: the agent reports a build that was not committed'
      )
      await expect(panel.getByText(VIDEO_GRAPH_DONE_TEXT)).toBeHidden()
    })

    test('materializes a committed graph node on the canvas', async ({
      comfyPage,
      postedMessages,
      getWebSocket
    }) => {
      const page = comfyPage.page
      const ws = await getWebSocket()
      const clientFrames: string[] = []
      ws.onMessage((message) => clientFrames.push(message.toString()))
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      const panel = page.locator('#agent-panel-root')
      await panel
        .getByRole('textbox', { name: /^Describe ideas/ })
        .fill('Build a graph')
      await panel.getByRole('button', { name: 'Send' }).click()
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
