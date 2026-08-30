import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  MESSAGE_DELTA_EVENT,
  MESSAGE_DONE_EVENT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

test.describe(
  'Agent stories derived from the G1 QA matrix',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('M1 awareness turn streams an answer without changing the canvas', async ({
      comfyPage,
      getWebSocket,
      postedMessages
    }) => {
      const page = comfyPage.page
      const initialGraph = await page.evaluate(() =>
        window.app!.graph.serialize()
      )

      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')
      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      await composer.fill('What does this workflow do?')
      await panel.getByRole('button', { name: 'Send' }).click()

      await expect.poll(() => postedMessages.length).toBe(1)
      const ws = await getWebSocket()
      pushEvent(ws, MESSAGE_DELTA_EVENT)
      pushEvent(ws, MESSAGE_DONE_EVENT)

      await expect(
        panel.locator('strong', { hasText: 'fully ready' })
      ).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.serialize()))
        .toEqual(initialGraph)
    })

    test('M2 agent write renders one node and advances the document sequence', () => {
      test.fixme(
        true,
        'Requires a live doc host and an authenticated agent turn.'
      )
      expect(false, 'Replace with the live document assertion').toBe(true)
    })

    test('M4 concurrent human and agent edits merge without a conflict dialog', () => {
      test.fixme(
        true,
        'Requires coordinated human mutation and live agent document operations.'
      )
      expect(false, 'Replace with the concurrent edit assertion').toBe(true)
    })

    test('M5 edits propagate between two tabs with distinct actors', () => {
      test.fixme(
        true,
        'Requires authenticated multi-tab document subscriptions.'
      )
      expect(false, 'Replace with the cross-tab propagation assertion').toBe(
        true
      )
    })

    test('M6 reconnect replays missed updates exactly once', () => {
      test.fixme(
        true,
        'Requires a controllable live document WebSocket and host replay.'
      )
      expect(false, 'Replace with the replay idempotency assertion').toBe(true)
    })

    test('M7 reload converges without reminting node identifiers', () => {
      test.fixme(
        true,
        'Blocked until persistent document identity is available across reloads.'
      )
      expect(false, 'Replace with the reload convergence assertion').toBe(true)
    })

    test('M11 an agent-selected new tab leaves existing tabs untouched', () => {
      test.fixme(true, 'Requires the live agent_active_tab server push.')
      expect(false, 'Replace with the tab preservation assertion').toBe(true)
    })

    test('M12 follower flag switches between legacy draft and CRDT rendering', () => {
      test.fixme(
        true,
        'Requires both backend write modes in the same browser environment.'
      )
      expect(false, 'Replace with the mode-switch assertion').toBe(true)
    })

    test('M14 an unauthorized subscription fails without projecting a graph', () => {
      test.fixme(
        true,
        'Requires an authenticated server to exercise authorization rejection.'
      )
      expect(false, 'Replace with the failed-subscription assertion').toBe(true)
    })
  }
)
