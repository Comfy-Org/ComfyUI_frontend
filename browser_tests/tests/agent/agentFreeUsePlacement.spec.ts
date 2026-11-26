import { expect, mergeTests } from '@playwright/test'

import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi
} from '@e2e/fixtures/agentPanelFixture'
import { DEFAULT_BILLING_STATUS } from '@e2e/fixtures/utils/cloudBillingMocks'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'

const FLAG = 'agent-free-use-message-placement'

function billingStatus({
  grantHeld,
  agentHasFunds = true
}: {
  grantHeld: boolean
  agentHasFunds?: boolean
}): BillingStatusResponse {
  return {
    ...DEFAULT_BILLING_STATUS,
    billing_rail: 'stripe',
    scoped_effective_has_funds: { agent: agentHasFunds },
    scoped_has_funds: { agent: grantHeld }
  }
}

const test = mergeTests(agentTest, hostTelemetryFixture, webSocketFixture)

test.describe(
  'Cloud Agent free-use notice',
  {
    tag: ['@cloud', '@agent', '@ui']
  },
  () => {
    test('keeps the selected near-composer notice without reading the retired flag', async ({
      hostTelemetry,
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { [FLAG]: 'near-composer', enable_telemetry: true },
        billingStatus: billingStatus({ grantHeld: true })
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()
      const notice = agentPanel.root.getByRole('note', {
        name: 'Free use notice'
      })
      await expect(notice).toBeVisible()
      await expect(notice).toHaveAttribute('data-placement', 'near-composer')
      expect(
        hostTelemetry.filter(
          ({ event }) => event === 'app:agent_free_use_exposure'
        )
      ).toEqual([])
    })
  }
)

test.describe(
  'Local Agent free-use notice',
  { tag: ['@oss', '@agent', '@ui'] },
  () => {
    test('shows the local default only while an Agent grant is available', async ({
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { enable_telemetry: true },
        billingStatus: billingStatus({ grantHeld: true })
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()

      const notice = agentPanel.root.getByRole('note', {
        name: 'Free use notice'
      })
      await expect(notice).toBeVisible()
      await expect(notice).toContainText('Try your first chat for free!')
      await expect(notice).toHaveAttribute('data-placement', 'near-composer')
      await expect(
        notice.getByRole('link', { name: 'Learn more' })
      ).toHaveAttribute(
        'href',
        'https://docs.comfy.org/agent-tools/in-app-agent#what-it-costs'
      )
    })

    test('explains workspace-credit use when Local starts without an Agent grant', async ({
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { enable_telemetry: true },
        billingStatus: billingStatus({
          grantHeld: false,
          agentHasFunds: false
        })
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()

      const notice = agentPanel.root.getByRole('note', {
        name: 'Agent cost notice'
      })
      await expect(notice).toBeVisible()
      await expect(notice).toContainText(
        'Comfy Agent uses your workspace credits'
      )
      await expect(
        notice.getByRole('link', { name: 'Learn more' })
      ).toHaveAttribute(
        'href',
        'https://docs.comfy.org/agent-tools/in-app-agent#what-it-costs'
      )
    })

    test('removes the free-use claim after the local Agent grant is spent', async ({
      getAgentSocket,
      page
    }) => {
      const accepted = {
        thread_id: '783eff5c-2133-45bb-9733-2b9637d3e79c',
        message_id: 'fb9d7a52-bc14-43c5-9039-52a346507e96',
        workflow_id: 'a385d379-9f50-4495-975d-b310a62370f6'
      }
      await mockAgentTurnApi(page, accepted)
      await bootAgentApp(page, true, {
        features: { enable_telemetry: true },
        billingStatus: billingStatus({ grantHeld: true })
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()
      const notice = agentPanel.root.getByRole('note', {
        name: 'Free use notice'
      })
      await expect(notice).toBeVisible()

      await page.route('**/api/billing/status', (route) =>
        route.fulfill({ json: billingStatus({ grantHeld: false }) })
      )
      const billingRead = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/billing/status'
      )
      const turnAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /^\/api\/agent\/threads\/[^/]+\/messages$/.test(
            new URL(response.url()).pathname
          )
      )
      await agentPanel.sendMessage('Use the current workflow')
      const socket = await getAgentSocket()
      await turnAccepted
      await expect(agentPanel.stopButton).toBeVisible()
      const completed: AgentWsEvent = {
        type: 'agent_message_done',
        data: { ...accepted, usage: null }
      }
      socket.send(JSON.stringify(completed))
      await billingRead

      await expect(notice).toBeHidden()
    })
  }
)
