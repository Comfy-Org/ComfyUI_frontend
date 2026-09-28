import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { zAgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const FUNDED_STATUS: BillingStatusResponse = {
  is_active: true,
  has_funds: true,
  scoped_effective_has_funds: { agent: true },
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  billing_status: 'paid',
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null
}

const EXHAUSTED_STATUS: BillingStatusResponse = {
  ...FUNDED_STATUS,
  scoped_effective_has_funds: { agent: false }
}

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

test.describe(
  'Agent standing credits-exhaustion lifecycle',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('refreshes, survives remount, recovers, and re-arms without a send refusal', async ({
      page,
      agentPanel,
      getWebSocket
    }) => {
      let billingStatus = FUNDED_STATUS
      await page.route('**/api/billing/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(billingStatus)
        })
      })
      await page.reload()
      await waitForCloudApp(page)

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const ws = await getWebSocket()
      const paywall = agentPanel.root.getByRole('alert').filter({
        hasText: enMessages.agent.paywall.title
      })

      async function completeTurn(
        prompt: string,
        nextStatus: BillingStatusResponse
      ): Promise<void> {
        const acceptedResponse = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            /\/api\/agent\/threads\/[^/]+\/messages$/.test(
              new URL(response.url()).pathname
            )
        )
        await agentPanel.sendMessage(prompt)
        const accepted = zAgentTurnAccepted.parse(
          await (await acceptedResponse).json()
        )
        await expect(
          agentPanel.root.getByRole('button', { name: enMessages.agent.stop })
        ).toBeVisible()

        billingStatus = nextStatus
        const billingRefresh = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            new URL(response.url()).pathname === '/api/billing/status'
        )
        pushEvent(ws, {
          type: 'agent_message_done',
          data: {
            message_id: accepted.message_id,
            thread_id: accepted.thread_id,
            usage: null
          }
        })
        await billingRefresh
        await expect(
          agentPanel.root.getByRole('button', { name: enMessages.agent.send })
        ).toBeVisible()
      }

      await completeTurn('Build a red fox workflow', EXHAUSTED_STATUS)
      await expect(paywall).toBeVisible()
      await expect(paywall).toContainText(
        enMessages.agent.paywall.body.subscribed
      )

      await agentPanel.root
        .getByRole('button', { name: enMessages.agent.close })
        .click()
      await expect(agentPanel.root).toHaveCount(0)
      await agentPanel.open()
      await expect(paywall).toBeVisible()

      await completeTurn('Make the lighting warmer', FUNDED_STATUS)
      await expect(paywall).toHaveCount(0)

      await completeTurn('Add shallow depth of field', EXHAUSTED_STATUS)
      await expect(paywall).toBeVisible()

      await completeTurn('Finish the workflow', FUNDED_STATUS)
      await expect(paywall).toHaveCount(0)
      await expect(
        agentPanel.root.getByText('Finish the workflow')
      ).toBeVisible()
    })
  }
)
