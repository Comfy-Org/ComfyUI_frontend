import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

// A Cloud owner with no plan can buy credits for the agent, but those credits
// do not run workflows. The agent's Out of credits card must say so before the
// purchase, not after (PM-2273 report #2).

const NO_FUNDS_ERROR = zAgentAdmissionError.parse({
  error: {
    message:
      'This workspace is out of funds. Add credits or subscribe to keep going.',
    reason: 'no_funds',
    type: 'PAYMENT_REQUIRED'
  }
})

const NO_PLAN_STATUS = {
  billing_rail: 'stripe',
  billing_status: 'inactive',
  has_funds: false,
  is_active: false,
  max_seats: 1,
  occupied_seats: 1,
  scoped_effective_has_funds: { agent: false },
  scoped_has_funds: { agent: false },
  scheduled_change: null,
  next_charge: null,
  subscription_state: 'never_subscribed',
  subscription_tier: 'FREE',
  ended_at: null,
  team_credit_stop: null
} satisfies BillingStatusResponse

async function showPaywall(page: Page) {
  const panel = page.locator('#agent-panel-root')
  await panel
    .getByRole('button', { name: enMessages.agent.switchWorkflow })
    .click()
  await page
    .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
    .click()

  await page.route('**/api/agent/threads/*/messages', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify(NO_FUNDS_ERROR)
    })
  })

  await panel
    .getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
    .fill('Make a red fox in the snow')
  await panel.getByRole('button', { name: enMessages.agent.send }).click()

  const card = panel
    .getByRole('alert')
    .filter({ hasText: enMessages.agent.paywall.title })
  await expect(card).toBeVisible()
  return card
}

agentTest.describe(
  'Agent paywall for an account without a plan',
  { tag: ['@cloud', '@ui'] },
  () => {
    agentTest(
      'says buying credits does not start a Cloud plan',
      { tag: '@screenshot' },
      async ({ page, agentPanel }) => {
        await page.route('**/api/billing/status', (route) =>
          route.fulfill(jsonRoute(NO_PLAN_STATUS))
        )
        await page.reload()
        await waitForCloudApp(page)

        await agentPanel.open()
        const card = await showPaywall(page)

        await expect(
          card.getByRole('button', {
            name: enMessages.agent.paywall.addCredits
          })
        ).toBeVisible()
        await expect(card.getByTestId('agent-paywall-plan-note')).toContainText(
          "Buying credits doesn't start a Cloud plan."
        )
        await expectElementScreenshot(card, 'agent-paywall-plan-note.png')
      }
    )
  }
)
