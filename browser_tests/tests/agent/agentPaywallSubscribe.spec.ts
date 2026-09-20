import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

// Regression e2e coverage for the fix in dialogService.showSubscriptionRequiredDialog:
// clicking the agent panel paywall's "Subscribe" action must always open the
// subscription dialog (or at least report a failure), never silently no-op.
// The unit test (dialogService.subscriptionRequired.test.ts) proves the exact
// timing race deterministically (a config fetch still `unloaded` at click
// time); this file drives the real chat panel end to end, through a real
// no-funds turn rejection surfacing the paywall card, and a real click.

const NO_FUNDS_ERROR = zAgentAdmissionError.parse({
  error: {
    message:
      'This workspace is out of funds. Add credits or subscribe to keep going.',
    reason: 'no_funds',
    type: 'PAYMENT_REQUIRED'
  }
})

const DIALOG_SELECTOR = '[aria-labelledby="subscription-required"]'

/**
 * Re-mocks `/features` (the subscription gate) and `/billing/capabilities`
 * (what makes the agent paywall card render a "subscriptionRequired"
 * presentation, independent of the gate above) and reloads so the fresh
 * values apply from a clean boot - the same "remock then reload" pattern
 * `subscription.spec.ts` uses for `window.__CONFIG__`-driven surfaces.
 */
async function reconfigureBilling(
  page: Page,
  { subscriptionRequired }: { subscriptionRequired: boolean }
): Promise<void> {
  const features: RemoteConfig = {
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_config: {
      advanced_disable_flags: true,
      bootstrap: { featureFlags: { 'agent-in-app-experience': true } }
    },
    subscription_required: subscriptionRequired
  }
  await page.route('**/api/features', (route) =>
    route.fulfill(jsonRoute(features))
  )
  await page.route('**/api/billing/capabilities', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill(
      jsonRoute(createBillingCapabilities('ws-personal', { can_top_up: false }))
    )
  })
  await page.reload()
  await waitForCloudApp(page)
}

/** The next turn POST fails with a `no_funds` admission error, surfacing the paywall card. */
async function mockNoFundsOnNextTurn(page: Page): Promise<void> {
  await page.route('**/api/agent/threads/*/messages', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify(NO_FUNDS_ERROR)
    })
  })
}

async function sendMessageExpectingPaywall(page: Page) {
  const panel = page.locator('#agent-panel-root')
  await panel
    .getByRole('button', { name: enMessages.agent.switchWorkflow })
    .click()
  await page
    .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
    .click()

  await mockNoFundsOnNextTurn(page)

  const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
  const sendButton = panel.getByRole('button', {
    name: enMessages.agent.send
  })
  await composer.fill('Make a red fox in the snow')
  await sendButton.click()

  await expect(
    panel.getByText(enMessages.agent.paywall.title, { exact: true })
  ).toBeVisible()
  const subscribeButton = panel.getByRole('button', {
    name: enMessages.agent.paywall.subscribe,
    exact: true
  })
  await expect(subscribeButton).toBeVisible()
  return { panel, subscribeButton }
}

agentTest.describe(
  'Agent paywall Subscribe action',
  { tag: ['@cloud', '@ui'] },
  () => {
    agentTest(
      'opens the subscription dialog once the config gate is open',
      async ({ page, agentPanel }, testInfo) => {
        await reconfigureBilling(page, { subscriptionRequired: true })

        await agentPanel.open()
        const { panel, subscribeButton } =
          await sendMessageExpectingPaywall(page)

        await testInfo.attach('agent-paywall-card', {
          body: await panel.screenshot({ animations: 'disabled' }),
          contentType: 'image/png'
        })

        await subscribeButton.click()

        const dialog = page.locator(DIALOG_SELECTOR)
        await expect(dialog).toBeVisible()

        await testInfo.attach('subscription-dialog-opened', {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png'
        })
      }
    )

    agentTest(
      'reports the failure instead of silently doing nothing when the gate stays closed',
      async ({ page, agentPanel }) => {
        await reconfigureBilling(page, { subscriptionRequired: false })

        await agentPanel.open()
        const { subscribeButton } = await sendMessageExpectingPaywall(page)

        const consoleErrors = collectConsoleErrors(page)
        await subscribeButton.click()

        const dialog = page.locator(DIALOG_SELECTOR)
        await expect(dialog).toBeHidden()
        await expect
          .poll(() =>
            consoleErrors.errors.some((line) =>
              line.includes('error_opening_subscription_dialog_gate_closed')
            )
          )
          .toBe(true)
        consoleErrors.stop()
      }
    )
  }
)
