import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'

// Regression e2e coverage for useBillingDialogs.showSubscriptionRequiredDialog:
// clicking the agent panel paywall's "Subscribe" action must always open the
// pricing dialog (or at least report a failure), never silently no-op.
// The unit test (useBillingDialogs.subscriptionRequired.test.ts) pins the
// bounded /features retry when the config snapshot is still `unloaded` at click
// time. That is a guard, not a confirmed cause of the production dead click.
// This file drives the real chat panel end to end, through a real no-funds
// turn rejection surfacing the paywall card, a real click, and the pricing
// content the dialog renders.

const NO_FUNDS_ERROR = zAgentAdmissionError.parse({
  error: {
    message:
      'This workspace is out of funds. Add credits or subscribe to keep going.',
    reason: 'no_funds',
    type: 'PAYMENT_REQUIRED'
  }
})

const DIALOG_SELECTOR = '[data-dialog-key="subscription-required"]'

/**
 * Re-mocks `/features` (the subscription gate), `/billing/capabilities`
 * (what makes the agent paywall card render a "subscriptionRequired"
 * presentation, independent of the gate above) and `/billing/plans` (so the
 * pricing dialog has a real plan to render) and reloads so the fresh values
 * apply from a clean boot - the same "remock then reload" pattern
 * `subscription.spec.ts` uses for `window.__CONFIG__`-driven surfaces.
 */
async function reconfigureBilling(
  page: Page,
  { subscriptionRequired }: { subscriptionRequired: boolean }
): Promise<void> {
  const features: RemoteConfig = {
    'agent-in-app-experience': true,
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_config: { advanced_disable_flags: true },
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
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(
      jsonRoute({
        plans: [
          createPlan({
            slug: 'creator-monthly',
            tier: 'CREATOR',
            duration: 'MONTHLY',
            priceCents: 3_500,
            monthlyCredits: 7_400
          })
        ]
      })
    )
  )
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

  const composer = panel.getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
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
        // An open but empty shell would still pass the check above; the
        // pricing table must actually render the plan the user can pick.
        await expect(
          dialog.getByText(enMessages.subscription.tiers.creator.name).first()
        ).toBeVisible()

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
