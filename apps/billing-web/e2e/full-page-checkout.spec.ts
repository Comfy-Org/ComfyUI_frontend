import type { Locator, Page } from '@playwright/test'

import { declinedOperation } from './fixtures/scenario'
import { installFakeStripe } from './fixtures/stripe'
import { entryPath, expect, test as base } from './fixtures/test'

const test = base.extend<{ fullPage: void }>({
  fullPage: [
    async ({ context, cloud }, use) => {
      await installFakeStripe(context)
      cloud.scenario.checkoutUi = 'full_page'
      cloud.scenario.preview = {
        ...cloud.scenario.preview,
        payment_method_configuration_id: 'pmc_e2e'
      }
      await use(undefined)
    },
    { auto: true }
  ]
})

const CHECKOUT = entryPath('checkout', { plan: 'pro_monthly' })
const EYEBROW = 'Subscribe to Pro Plan · Personal'
const FORM_FAILED = "The payment form couldn't load"
const SAVED_FAILED = "Your saved payment methods couldn't load"

/** 553-9853's destructive red, the nearest palette step to Figma's #f87171. */
const INVALID_RED = 'rgb(247, 89, 81)'

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay and subscribe' })
const tab = (page: Page, name: 'Saved' | 'Add new payment') =>
  page.getByRole('tab', { name })

function failPaymentElementLoads(page: Page) {
  return page.addInitScript(() => {
    Object.assign(window, { __e2eStripeLoadErrors: 1 })
  })
}

test('names the plan and the workspace, and enables Pay once the form is ready', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  await signIn(CHECKOUT)

  await expect(page.getByText(EYEBROW)).toBeVisible()
  await expect(payButton(page)).toBeEnabled()
  await expect(tab(page, 'Saved')).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeHidden()
  expect(
    cloud.requests.some((request) => request.path === '/billing/capabilities')
  ).toBe(true)
})

for (const { name, query } of [
  { name: 'no return_to', query: 'product=comfyui&plan=pro_monthly' },
  {
    name: 'an unapproved return_to',
    query: 'product=comfyui&return_to=elsewhere&plan=pro_monthly'
  }
]) {
  test(`a link with ${name} still checks out, and the back arrow goes to Plan & Credits`, async ({
    page,
    cloud,
    signIn
  }) => {
    cloud.scenario.paymentMethods = []
    await signIn(`/v1/checkout?${query}`)

    await expect(page.getByText(EYEBROW)).toBeVisible()
    await expect(payButton(page)).toBeEnabled()

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page).toHaveURL(
      'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws_e2e'
    )
  })
}

test('360-4874: with no saved method a failed form takes the column, and Try again remounts it', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  await failPaymentElementLoads(page)
  await signIn(CHECKOUT)

  await expect(page.getByText(FORM_FAILED)).toBeVisible()
  await expect(payButton(page)).toBeHidden()
  await expect(page.getByText(EYEBROW)).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(payButton(page)).toBeEnabled()
  await expect(page.getByText(FORM_FAILED)).toBeHidden()
})

const savedPicker = (page: Page) =>
  page.getByRole('combobox', { name: 'Choose a saved payment method' })

test('opens on a lone saved method as a static row and subscribes with it, no card token', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(CHECKOUT)

  await expect(tab(page, 'Saved')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('·· 4242')).toBeVisible()
  await expect(savedPicker(page)).toBeHidden()
  await expect(page.getByText('Billing address')).toBeHidden()
  await payButton(page).click()

  await expect
    .poll(() =>
      cloud.requests.find((request) => request.path === '/billing/subscribe')
    )
    .toMatchObject({ body: { saved_payment_method_id: 'pm_e2e' } })
  const subscribe = cloud.requests.find(
    (request) => request.path === '/billing/subscribe'
  )
  expect(subscribe?.body).not.toHaveProperty('confirmation_token')
})

test('two saved methods keep the picker, and Pay charges the one picked', async ({
  page,
  cloud,
  signIn
}) => {
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
  await signIn(CHECKOUT)

  await expect(savedPicker(page)).toContainText('·· 4242')
  await savedPicker(page).click()
  await page.getByRole('option', { name: /4402/ }).click()
  await expect(savedPicker(page)).toContainText('·· 4402')
  await payButton(page).click()

  await expect
    .poll(() =>
      cloud.requests.find((request) => request.path === '/billing/subscribe')
    )
    .toMatchObject({ body: { saved_payment_method_id: 'pm_e2e_mastercard' } })
})

test('the saved-method list opens on the same dark surface as its picker', async ({
  page,
  cloud,
  signIn
}) => {
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
  await signIn(CHECKOUT)

  const background = (locator: Locator) =>
    locator.evaluate((element) => getComputedStyle(element).backgroundColor)
  const pickerBackground = await background(savedPicker(page))

  await savedPicker(page).click()
  const list = page.getByRole('listbox')
  await expect(list).toBeVisible()
  await expect.poll(() => background(list)).toBe(pickerBackground)
})

test('368-15319: a failed form beside a saved method stays inside Add new, and Saved stays payable', async ({
  page,
  signIn
}) => {
  await failPaymentElementLoads(page)
  await signIn(CHECKOUT)

  await expect(tab(page, 'Saved')).toHaveAttribute('aria-selected', 'true')
  await expect(payButton(page)).toBeEnabled()
  await expect(page.getByText(FORM_FAILED)).toBeHidden()

  await tab(page, 'Add new payment').click()

  await expect(page.getByText(FORM_FAILED)).toBeVisible()
  await expect(
    page.getByText('or pay with a saved payment method.', { exact: false })
  ).toBeVisible()
  await expect(payButton(page)).toBeHidden()

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(payButton(page)).toBeEnabled()
  await expect(tab(page, 'Add new payment')).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

test('368-15401: a failed saved-methods read errors on Saved only, and Add new stays live', async ({
  page,
  cloud,
  signIn
}) => {
  let healthy = false
  cloud.reply('GET', '/billing/payment-methods', () =>
    healthy
      ? { body: cloud.scenario.paymentMethods }
      : { status: 500, body: { code: 'INTERNAL', message: 'boom' } }
  )
  await signIn(CHECKOUT)

  await expect(tab(page, 'Saved')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(SAVED_FAILED)).toBeVisible()
  await expect(page.getByText('Billing address')).toBeHidden()
  await expect(payButton(page)).toBeHidden()

  await tab(page, 'Add new payment').click()
  await expect(payButton(page)).toBeEnabled()

  await tab(page, 'Saved').click()
  healthy = true
  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(page.getByText('·· 4242')).toBeVisible()
  await expect(page.getByText(SAVED_FAILED)).toBeHidden()
  await expect(payButton(page)).toBeEnabled()
})

test('a declined Pay leaves the card above an unchanged Pay, with support one click away', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.scenario.operations.op_subscribe = {
    ...declinedOperation('op_subscribe'),
    decline_reason: 'insufficient_funds'
  }
  await signIn(CHECKOUT)

  await payButton(page).click()

  const card = page.getByRole('alert')
  await expect(card).toContainText('Payment declined')
  await expect(card).toContainText('Reported issue: Insufficient funds')
  await expect(payButton(page)).toBeEnabled()
  const support = page.getByRole('link', { name: 'Contact support' })
  await expect(support).toHaveAttribute('href', /op_subscribe/)
  await expect(support).toHaveAttribute('href', /insufficient_funds/)
  await expect(page).toHaveURL(/\/v1\/checkout\?/)
})

test('a payment the customer did not approve reads as not completed, not as a decline', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.scenario.operations.op_subscribe = {
    ...declinedOperation('op_subscribe'),
    decline_reason: 'payment_not_completed',
    recovery_action: 'retry'
  }
  await signIn(CHECKOUT)

  await payButton(page).click()

  const card = page.getByRole('alert')
  await expect(card).toContainText('Payment not completed')
  await expect(card).not.toContainText('Reported issue')
  await expect(payButton(page)).toBeEnabled()
})

test('314-10612: a Pay the server refuses is the processing error card with its sentence, and support quotes the code', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.reply('POST', '/billing/subscribe', () => ({
    status: 500,
    body: {
      code: 'INTERNAL',
      message: 'Billing is temporarily unavailable. Please try again shortly.'
    }
  }))
  await signIn(CHECKOUT)

  await payButton(page).click()

  const card = page.getByRole('alert')
  await expect(card).toContainText("Payment couldn't be processed")
  await expect(card).toContainText(
    'Billing is temporarily unavailable. Please try again shortly.'
  )
  await expect(payButton(page)).toBeEnabled()
  await expect(
    page.getByRole('link', { name: 'Contact support' })
  ).toHaveAttribute('href', /Error%20code%3A%20REQUEST_FAILED/)
})

test('553-9297: a plan change on a plan set to end needs the keep-subscription tick: Pay without it sends nothing, with it sends the consent', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.status = {
    ...cloud.scenario.status,
    cancel_at: '2026-07-28T00:00:00.000Z'
  }
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    transition_type: 'upgrade',
    requires_reactivation_confirmation: true,
    cost_next_period_cents: 10_000
  }
  await signIn(CHECKOUT)

  const notice = page.getByTestId('keep-subscription-notice')
  await expect(notice).toContainText(
    'Your plan was set to end on July 28, 2026'
  )
  await expect(notice).toContainText(
    'Upgrading keeps your subscription, and it renews that day at $100.00.'
  )
  const box = page.getByRole('checkbox', {
    name: 'Keep my subscription and renew it'
  })
  await expect(payButton(page)).toBeEnabled()
  const noticeBox = await notice.boundingBox()
  const payBox = await payButton(page).boundingBox()
  expect(
    payBox && noticeBox && payBox.y - (noticeBox.y + noticeBox.height)
  ).toBe(24)

  await payButton(page).click()

  await expect(box).toHaveAttribute('aria-invalid', 'true')
  await expect(box).toBeFocused()
  const error = notice.getByText(
    'Check the box to keep your subscription, then pay.'
  )
  await expect(error).toBeVisible()
  await expect(box).toHaveAccessibleDescription(
    'Check the box to keep your subscription, then pay.'
  )
  await expect(notice.getByTestId('keep-subscription-box')).toHaveCSS(
    'border-color',
    INVALID_RED
  )
  await expect(notice.getByText('Keep my subscription and renew it')).toHaveCSS(
    'color',
    INVALID_RED
  )
  await expect(error).toHaveCSS('color', INVALID_RED)
  await expect(payButton(page)).toBeEnabled()
  expect(
    cloud.requests.some((request) => request.path === '/billing/subscribe')
  ).toBe(false)

  await notice.getByText('Keep my subscription and renew it').click()
  await expect(box).toHaveAttribute('aria-invalid', 'false')
  await payButton(page).click()

  await expect
    .poll(() =>
      cloud.requests.find((request) => request.path === '/billing/subscribe')
    )
    .toMatchObject({ body: { confirm_reactivation: true } })
})
