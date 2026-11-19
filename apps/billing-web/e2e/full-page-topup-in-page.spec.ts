import type { Page } from '@playwright/test'

import { E2E_USER } from './fixtures/env'
import { installFakeStripe } from './fixtures/stripe'
import { entryPath, expect, test as base } from './fixtures/test'

const test = base.extend<{ inPage: void }>({
  inPage: [
    async ({ context, cloud }, use) => {
      await installFakeStripe(context)
      cloud.scenario.checkoutUi = 'full_page'
      cloud.scenario.topupQuote = {
        ...cloud.scenario.topupQuote,
        payment_method_configuration_id: 'pmc_e2e_topup'
      }
      cloud.scenario.paymentMethods = [
        ...cloud.scenario.paymentMethods,
        {
          id: 'pm_e2e_mastercard',
          type: 'card',
          brand: 'mastercard',
          last4: '4402',
          is_default: false
        }
      ]
      cloud.reply('POST', '/billing/topup/interactive', () => ({
        body: {
          amount_cents: 2500,
          billing_op_id: 'op_topup',
          status: 'pending',
          topup_id: 'op_topup'
        }
      }))
      await use(undefined)
    },
    { auto: true }
  ]
})

const AUTO_TOP_UP = {
  auto_top_up_threshold_credits: '1000',
  auto_top_up_target_credits: '11550',
  auto_top_up_monthly_budget_cents: '10000'
}

const tab = (page: Page, name: 'Saved' | 'Add new payment') =>
  page.getByRole('tab', { name })

async function payWithMastercard(page: Page) {
  await expect(tab(page, 'Saved')).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'Add new payment')).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Choose a saved payment method' })
    .click()
  await page.getByRole('option', { name: /4402/ }).click()
  await page.getByRole('button', { name: 'Pay', exact: true }).click()
}

const interactiveTopup = (cloud: { requests: readonly { path: string }[] }) =>
  cloud.requests.find(
    (request) => request.path === '/billing/topup/interactive'
  )

test('a Cloud top-up link with auto top-up pays the picked saved card in the page and sends the settings', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.unifiedBillingSettings = true
  await signIn(entryPath('top-up', { amount_cents: '2500', ...AUTO_TOP_UP }))

  await expect(page.getByTestId('checkout-auto-top-up-consent')).toContainText(
    'up to $100.00 a month'
  )
  await payWithMastercard(page)

  await expect
    .poll(() => interactiveTopup(cloud))
    .toMatchObject({
      body: {
        amount_cents: 2500,
        saved_payment_method_id: 'pm_e2e_mastercard',
        auto_top_up: {
          threshold_credits: 1000,
          target_credits: 11550,
          monthly_budget_cents: 10000
        }
      }
    })
  expect(
    cloud.requests.some(
      (request) =>
        request.path === '/billing/topup/checkout' ||
        request.path === '/billing/topup'
    )
  ).toBe(false)
})

test('a handoff top-up pays in the page on its scoped session', async ({
  page,
  cloud
}) => {
  cloud.reply('POST', '/auth/handoffs/exchange', () => ({
    body: {
      session_token: 'handoff-scoped-session',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      user: { id: E2E_USER.uid, email: E2E_USER.email },
      workspace: { id: E2E_USER.workspaceId, name: 'Acme', type: 'team' },
      role: 'owner'
    }
  }))
  const query = new URLSearchParams({
    intent: 'top-up',
    amount_cents: '2500',
    ...AUTO_TOP_UP
  })
  await page.goto(`/handoff?${query}#token=one-time-token`)

  await expect(page.getByTestId('checkout-auto-top-up-consent')).toContainText(
    'up to $100.00 a month'
  )
  await payWithMastercard(page)

  await expect
    .poll(() => interactiveTopup(cloud))
    .toMatchObject({
      authorization: 'Bearer handoff-scoped-session',
      body: {
        saved_payment_method_id: 'pm_e2e_mastercard',
        auto_top_up: { threshold_credits: 1000, target_credits: 11550 }
      }
    })
  expect(
    cloud.requests.some((request) => request.path === '/billing/topup/checkout')
  ).toBe(false)
})
