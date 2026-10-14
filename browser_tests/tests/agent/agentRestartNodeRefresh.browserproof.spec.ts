import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'Agent restart refresh browser proof',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ connectWebSocketToServer: false, objectInfo: 'server' })

    test('refreshes definitions without reversing a queued tab switch or losing its edit', async ({
      agentPanel,
      comfyPage,
      getAgentSocket
    }) => {
      test.setTimeout(60_000)
      const page = comfyPage.page
      const topbar = new Topbar(page)
      let releaseRefresh!: () => void
      let markRefreshEntered!: () => void
      const refreshEntered = new Promise<void>((resolve) => {
        markRefreshEntered = resolve
      })
      const refreshHeld = new Promise<void>((resolve) => {
        releaseRefresh = resolve
      })

      await page.route('**/object_info', async (route) => {
        markRefreshEntered()
        await refreshHeld
        await route.fulfill(
          jsonRoute({
            ...agentReplayNodeDefs,
            BrowserProofNode: {
              ...agentReplayNodeDefs.KSampler,
              name: 'BrowserProofNode',
              display_name: 'Browser Proof Node'
            }
          })
        )
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const ws: WebSocketRoute = await getAgentSocket()
      const restart: AgentWsEvent = {
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-restart-browser-proof',
          tool_name: 'restart_comfyui',
          status: 'success',
          message_id: 'message-restart-browser-proof',
          thread_id: 'thread-restart-browser-proof'
        }
      }
      ws.send(JSON.stringify(restart))
      await Promise.race([
        refreshEntered,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('restart did not request fresh node definitions')
              ),
            5_000
          )
        )
      ])

      await page
        .getByRole('button', { name: 'New Blank Workflow', exact: true })
        .or(
          page.getByRole('button', {
            name: enMessages.sideToolbar.newBlankWorkflow,
            exact: true
          })
        )
        .click()
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
      const editId = await page.evaluate(() => {
        const node = window.LiteGraph!.createNode('KSampler')
        if (!node) throw new Error('KSampler is unavailable')
        node.pos = [321, 234]
        window.app!.graph.add(node)
        return String(node.id)
      })

      releaseRefresh()

      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(window.LiteGraph!.createNode('BrowserProofNode'))
          )
        )
        .toBe(true)
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
      await expect
        .poll(() =>
          page.evaluate(
            (id) =>
              window.app!.graph.nodes.some((node) => String(node.id) === id),
            editId
          )
        )
        .toBe(true)

      await page.screenshot({
        path: 'test-results/agent-restart-node-refresh-browserproof.png',
        fullPage: true
      })
    })
  }
)
