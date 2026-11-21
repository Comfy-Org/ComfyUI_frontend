import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import {
  AGENT_NO_FUNDS_ERROR,
  NEVER_SUBSCRIBED_BILLING_STATUS
} from '@e2e/fixtures/data/agent/agentPaywallPlanNote'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

agentTest.describe(
  'Agent paywall for an account without a plan',
  { tag: ['@cloud', '@ui'] },
  () => {
    agentTest.beforeEach(async ({ page, agentPanel }) => {
      await page.route('**/api/billing/status', (route) =>
        route.fulfill(jsonRoute(NEVER_SUBSCRIBED_BILLING_STATUS))
      )
      await page.route('**/api/agent/threads/*/messages', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ ...jsonRoute(AGENT_NO_FUNDS_ERROR), status: 402 })
          : route.fallback()
      )
      await page.reload()
      await waitForCloudApp(page)
      await agentPanel.open()
    })

    agentTest(
      'says buying credits does not start a Cloud plan',
      { tag: '@screenshot' },
      async ({ page }) => {
        const panel = page.locator('#agent-panel-root')
        await panel
          .getByRole('button', { name: enMessages.agent.switchWorkflow })
          .click()
        await page
          .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
          .click()
        await panel
          .getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
          .fill('Make a red fox in the snow')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()

        const card = panel
          .getByRole('alert')
          .filter({ hasText: enMessages.agent.paywall.title })
        await expect(card).toBeVisible()
        await expect(
          card.getByRole('button', {
            name: enMessages.agent.paywall.addCredits
          })
        ).toBeVisible()
        await expect(
          card.getByRole('button', {
            name: enMessages.agent.paywall.subscribe,
            exact: true
          })
        ).toBeVisible()
        await expect(card.getByTestId('agent-paywall-plan-note')).toHaveText(
          enMessages.credits.topUp.planRequiredSubscribe
        )
        await expectElementScreenshot(card, 'agent-paywall-plan-note.png')
      }
    )
  }
)
