import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AGENT_SOCKET_URL } from '@e2e/fixtures/agentSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { agentComposerRunMode } from '@e2e/fixtures/data/agent/agentComposerPerformance'
import { tabActivationChats } from '@e2e/fixtures/data/agent/tabActivationChats'
import { AgentWorkflowChatsMock } from '@e2e/fixtures/helpers/agentWorkflowChats'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { nextFrame } from '@e2e/fixtures/utils/timing'

class TabActivationChats {
  readonly panel: AgentPanel
  readonly topbar: Topbar
  readonly transcriptReads: string[] = []

  constructor(private readonly page: Page) {
    this.panel = new AgentPanel(page)
    this.topbar = new Topbar(page)
  }

  private async refreshAfter(action: () => Promise<void>): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/agent/threads' &&
          response.request().method() === 'GET'
      ),
      action()
    ])
    expect(await response.finished()).toBeNull()
    await nextFrame(this.page)
  }

  async openChatFromHistory(title: string): Promise<void> {
    await this.selectChatFromHistory(title)
    await this.waitForFollowToSettle()
  }

  async selectChatFromHistory(title: string): Promise<void> {
    await this.refreshAfter(() => this.panel.historyButton.click())
    await this.refreshAfter(() =>
      this.panel.root.getByRole('button', { name: title, exact: true }).click()
    )
  }

  async activateWorkflow(name: string): Promise<void> {
    await this.topbar.getWorkflowTab(name).click()
    await this.waitForFollowToSettle()
  }

  async waitForFollowToSettle(): Promise<void> {
    await nextFrame(this.page)
    await expect(
      this.panel.root.getByTestId('agent-panel-footer')
    ).not.toHaveAttribute('inert')
  }
}

export const tabActivationTest = agentTest.extend<{
  tabChats: TabActivationChats
}>({
  tabChats: async ({ page, agentFlagEnabled }, use) => {
    const chats = new AgentWorkflowChatsMock(tabActivationChats)
    const tabChats = new TabActivationChats(page)
    const unexpectedMutations: string[] = []
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      (route) => {
        if (route.request().method() !== 'GET')
          unexpectedMutations.push(
            `${route.request().method()} ${new URL(route.request().url()).pathname}`
          )
        return route.fulfill({ status: 404, json: {} })
      }
    )
    await page.routeWebSocket(AGENT_SOCKET_URL, () => {})
    await page.routeWebSocket(/\/ws(?:\?|$)/, (ws) => {
      ws.send(
        JSON.stringify({
          type: 'status',
          data: { status: { exec_info: { queue_remaining: 0 } } }
        })
      )
    })
    await bootAgentApp(page, agentFlagEnabled, {
      beforeNavigate: async (page) => {
        await chats.route(page)
        await page.route('**/api/agent/threads/*/messages', (route) => {
          if (route.request().method() === 'GET')
            tabChats.transcriptReads.push(
              new URL(route.request().url()).pathname.split('/')[4]
            )
          return route.fallback()
        })
        await page.route('**/api/agent/run-mode', (route) =>
          route.fulfill(jsonRoute(agentComposerRunMode))
        )
        await page.route('**/api/experiment/models', (route) =>
          route.fulfill(jsonRoute([]))
        )
        await page.route('**/api/internal/cloud_analytics', (route) =>
          route.fulfill({ status: 204 })
        )
      }
    })
    await tabChats.panel.open()
    await use(tabChats)
    if (await tabChats.panel.root.getByTestId('agent-panel-footer').isVisible())
      await tabChats.waitForFollowToSettle()
    expect(unexpectedMutations).toEqual([])
  }
})
