import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  BUILD_VIDEO_GRAPH_TOOL_EVENT,
  MESSAGE_DONE_EVENT,
  TURN_ACCEPTED,
  VIDEO_GRAPH_DONE_EVENT
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe('In-App Agent graph mutations', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test.beforeEach(async ({ page, agentFlagEnabled }) => {
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          ...jsonRoute(TURN_ACCEPTED),
          status: 202
        })
      }
      return route.fulfill(jsonRoute([]))
    })
    await bootAgentApp(page, agentFlagEnabled)
    await page.evaluate(() => window.app!.graph.clear())
  })

  test('GM-96 keeps a completed graph-building turn in sync with the canvas', async ({
    page,
    getWebSocket
  }) => {
    expect(await page.evaluate(() => window.app!.graph.nodes.length)).toBe(0)

    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()

    const panel = page.locator('#agent-panel-root')
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    await composer.fill('Build a Wan 2.2 two-stage video graph')

    const post = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes('/api/agent/threads/') &&
        request.url().endsWith('/messages')
    )
    const ws = await getWebSocket()
    await panel.getByRole('button', { name: 'Send' }).click()
    expect((await post).postData()).toContain(
      'Build a Wan 2.2 two-stage video graph'
    )
    await expect(composer).toHaveValue('')

    for (const event of [
      BUILD_VIDEO_GRAPH_TOOL_EVENT,
      VIDEO_GRAPH_DONE_EVENT,
      MESSAGE_DONE_EVENT
    ] satisfies AgentWsEvent[]) {
      ws.send(JSON.stringify(event))
    }

    await expect(
      panel.getByText('The Wan 2.2 two-stage graph is ready.')
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
      .toBeGreaterThanOrEqual(1)
  })
})
