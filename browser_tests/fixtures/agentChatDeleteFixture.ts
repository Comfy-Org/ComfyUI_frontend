import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  agentThreadPage,
  agentThreadSummary,
  agentUserTranscript
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

interface AgentChatDeleteServer {
  readonly deleteRequests: readonly string[]
  setFailDeletes: (fail: boolean) => void
}

type AgentChatDeleteFixtures = {
  agentPanel: AgentPanel
  chatDeleteServer: AgentChatDeleteServer
}

/** Provides a stateful mock thread-deletion server and an opened agent panel. */
export const agentChatDeleteTest = agentTest.extend<AgentChatDeleteFixtures>({
  chatDeleteServer: async ({ page }, use) => {
    let threads = [agentThreadSummary('th-1', 'Duck workflow chat')]
    let failDeletes = false
    const deleteRequests: string[] = []

    await page.route(/\/api\/agent\/threads(?:\?.*)?$/, (route) =>
      route.fulfill(jsonRoute(agentThreadPage(threads)))
    )
    await page.route(/\/api\/agent\/threads\/([^/]+)$/, (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback()
      const id = route.request().url().split('/').pop() ?? ''
      deleteRequests.push(id)
      if (failDeletes) {
        return route.fulfill({
          ...jsonRoute({ error: 'internal server error' }),
          status: 500
        })
      }
      threads = threads.filter((thread) => thread.id !== id)
      return route.fulfill({ status: 204 })
    })
    await page.route(
      /\/api\/agent\/threads\/([^/]+)\/messages(?:\?.*)?$/,
      (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        return route.fulfill(
          jsonRoute(agentUserTranscript('th-1', '', 'Build a duck'))
        )
      }
    )

    await use({
      deleteRequests,
      setFailDeletes: (fail: boolean) => {
        failDeletes = fail
      }
    })
  },
  agentPanel: async (
    { page, agentFlagEnabled, chatDeleteServer: _server },
    use
  ) => {
    await bootAgentApp(page, agentFlagEnabled)
    const panel = new AgentPanel(page)
    await panel.open(30_000)
    await use(panel)
  }
})
