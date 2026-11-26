import type { Page } from '@playwright/test'

import { E2E_USER } from './fixtures/env'
import { processingOperation, succeededOperation } from './fixtures/scenario'
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

const PURCHASE_PATH = '/billing/topup/purchases/tpp_e2e'

function purchase(status: string, billingOpId?: string) {
  return {
    body: {
      purchase_id: 'tpp_e2e',
      status,
      amount_cents: 2500,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ...(billingOpId === undefined ? {} : { billing_op_id: billingOpId })
    }
  }
}

const interactiveTopups = (cloud: { requests: readonly { path: string }[] }) =>
  cloud.requests.filter(
    (request) => request.path === '/billing/topup/interactive'
  )

test('a Cloud purchase link pays through its purchase, and a reload while the payment is unresolved follows it and offers no second Pay', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.unifiedBillingSettings = true
  let attempt: string | undefined
  cloud.reply('GET', PURCHASE_PATH, () =>
    purchase(attempt === undefined ? 'open' : 'processing', attempt)
  )
  cloud.reply('POST', '/billing/topup/interactive', () => {
    attempt = 'op_topup'
    cloud.scenario.operations.op_topup = processingOperation('op_topup')
    return {
      body: {
        amount_cents: 2500,
        billing_op_id: 'op_topup',
        status: 'pending',
        topup_id: 'op_topup'
      }
    }
  })
  await signIn(
    entryPath('top-up', { amount_cents: '2500', purchase: 'tpp_e2e' })
  )

  await payWithMastercard(page)
  await expect
    .poll(() => interactiveTopup(cloud))
    .toMatchObject({
      body: {
        purchase_id: 'tpp_e2e',
        saved_payment_method_id: 'pm_e2e_mastercard'
      }
    })

  await page.reload()

  await expect(page.getByRole('status')).toContainText(
    'This payment is already processing'
  )
  await expect(
    page.getByRole('button', { name: 'Pay', exact: true })
  ).toBeDisabled()
  expect(interactiveTopups(cloud)).toHaveLength(1)
})

for (const { name, reply } of [
  {
    name: 'a newer Continue replaced',
    reply: () => purchase('superseded')
  },
  {
    name: 'another account opened',
    reply: () => ({
      status: 404,
      body: { code: 'PURCHASE_NOT_FOUND', message: 'purchase not found' }
    })
  }
]) {
  test(`a Cloud purchase link that ${name} offers no Pay`, async ({
    page,
    cloud,
    signIn
  }) => {
    cloud.scenario.unifiedBillingSettings = true
    cloud.reply('GET', PURCHASE_PATH, reply)
    await signIn(
      entryPath('top-up', { amount_cents: '2500', purchase: 'tpp_e2e' })
    )

    await expect(
      page.getByRole('heading', { name: 'Checkout not available' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Pay', exact: true })
    ).toHaveCount(0)
    expect(interactiveTopups(cloud)).toHaveLength(0)
  })
}

for (const { name, query } of [
  { name: 'without auto top-up', query: {} },
  { name: 'with auto top-up', query: AUTO_TOP_UP }
]) {
  test(`a stale Cloud purchase link ${name} on a workspace with no payment configuration refuses, and opens no unbound hosted checkout`, async ({
    page,
    cloud,
    signIn
  }) => {
    cloud.scenario.unifiedBillingSettings = true
    const { payment_method_configuration_id: _, ...unconfigured } =
      cloud.scenario.topupQuote
    cloud.scenario.topupQuote = unconfigured
    cloud.reply('GET', PURCHASE_PATH, () => purchase('open'))
    await signIn(
      entryPath('top-up', {
        amount_cents: '2500',
        purchase: 'tpp_e2e',
        ...query
      })
    )

    await expect(
      page.getByRole('heading', { name: 'Checkout not available' })
    ).toBeVisible()
    await expect(
      page.getByText(/Start Add credits again in Comfy/)
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Pay', exact: true })
    ).toHaveCount(0)
    expect(
      cloud.requests.filter((request) =>
        request.path.startsWith('/billing/topup/checkout')
      )
    ).toHaveLength(0)
    expect(interactiveTopups(cloud)).toHaveLength(0)
  })
}

test('a new card’s bank check returns to its purchase, which the page recovers with operation storage refused, offering no second Pay', async ({
  page,
  cloud,
  signIn
}) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('comfy:billing:operation'))
        throw new DOMException('refused', 'QuotaExceededError')
      setItem.call(this, key, value)
    }
  })
  cloud.scenario.unifiedBillingSettings = true
  cloud.scenario.paymentMethods = []
  let paid = false
  cloud.reply('GET', PURCHASE_PATH, () =>
    paid ? purchase('paid', 'op_topup') : purchase('open')
  )
  await signIn(
    entryPath('top-up', { amount_cents: '2500', purchase: 'tpp_e2e' })
  )

  await page.getByRole('button', { name: 'Pay', exact: true }).click()
  await expect.poll(() => interactiveTopup(cloud)).toBeDefined()
  const sent = interactiveTopup(cloud)
  expect(sent).toMatchObject({
    body: {
      purchase_id: 'tpp_e2e',
      confirmation_token: 'ctok_e2e_fake',
      return_url: expect.stringContaining('purchase=tpp_e2e')
    }
  })
  const body = cloud.requests.find(
    (request) => request.path === '/billing/topup/interactive'
  )?.body
  const returnUrl =
    typeof body === 'object' && body !== null && 'return_url' in body
      ? String(body.return_url)
      : ''

  paid = true
  cloud.scenario.operations.op_topup = succeededOperation('op_topup')
  await page.goto(returnUrl)

  await expect(
    page.getByRole('heading', { name: 'Already completed' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Pay', exact: true })
  ).toHaveCount(0)
  expect(interactiveTopups(cloud)).toHaveLength(1)
})
