import type { Page, WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import type {
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

class AgentCreditsLifecycleFixture {
  constructor(
    private readonly page: Page,
    private readonly agentPanel: AgentPanel,
    private readonly acceptedTurns: AgentTurnAccepted[],
    private readonly ws: WebSocketRoute,
    private readonly setAgentFunds: (hasFunds: boolean) => void
  ) {}

  async completeTurn(prompt: string, hasFunds: boolean): Promise<void> {
    const acceptedTurnCount = this.acceptedTurns.length
    await this.agentPanel.sendMessage(prompt)
    await expect
      .poll(() => this.acceptedTurns.length)
      .toBe(acceptedTurnCount + 1)
    const accepted = this.acceptedTurns.at(acceptedTurnCount)
    if (accepted === undefined) {
      throw new Error('Accepted turn fixture did not record the submitted turn')
    }

    await expect(
      this.agentPanel.root.getByRole('button', { name: 'Stop' })
    ).toBeVisible()
    this.setAgentFunds(hasFunds)
    const billingRefresh = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/billing/status'
    )
    const doneEvent: AgentWsEvent = {
      type: 'agent_message_done',
      data: {
        message_id: accepted.message_id,
        thread_id: accepted.thread_id,
        usage: {
          input_tokens: 4493,
          output_tokens: 425,
          total_tokens: 12393,
          cache_read_input_tokens: 35596,
          cache_creation_input_tokens: 0
        }
      }
    }
    this.ws.send(JSON.stringify(doneEvent))
    await billingRefresh
  }
}

const base = mergeTests(agentTest, webSocketFixture)

export const test = base.extend<{
  creditsLifecycle: AgentCreditsLifecycleFixture
}>({
  creditsLifecycle: async (
    { acceptedTurns, agentBilling, agentPanel, getWebSocket, page },
    use
  ) => {
    const ws = await getWebSocket()
    await use(
      new AgentCreditsLifecycleFixture(
        page,
        agentPanel,
        acceptedTurns,
        ws,
        (hasFunds) => agentBilling.setAgentFunds(hasFunds)
      )
    )
  }
})
