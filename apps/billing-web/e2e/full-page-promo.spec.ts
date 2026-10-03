import type { Page } from '@playwright/test'

import type { MockCloud } from './fixtures/cloud'
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

/**
 * Prices LAUNCH20 at 20% off the $50 plan and refuses any other code the way
 * billing does, with a 400 carrying `PROMOTION_CODE_INVALID`.
 */
function quoteCodes(cloud: MockCloud, valid: () => boolean = () => true) {
  cloud.reply('POST', '/billing/preview-subscribe', ({ body }) => {
    const code =
      typeof body === 'object' && body !== null && 'promotion_code' in body
        ? String(body.promotion_code)
        : undefined
    if (code === undefined) return { body: cloud.scenario.preview }
    if (code.toUpperCase() !== 'LAUNCH20' || !valid())
      return {
        status: 400,
        body: {
          code: 'PROMOTION_CODE_INVALID',
          message: 'promotion code is invalid, inactive, or not applicable'
        }
      }
    return {
      body: {
        ...cloud.scenario.preview,
        quote_id: 'quote_launch20',
        amount_due_cents: 4000,
        promotion_code: 'LAUNCH20',
        discounts: [
          { kind: 'promotion', code: 'LAUNCH20', amount_off_cents: 1000 }
        ]
      }
    }
  })
}

const summary = (page: Page) =>
  page.getByRole('region', { name: 'Order summary' })
const promoField = (page: Page) =>
  page.getByRole('textbox', { name: 'Promo code' })

async function enterCode(page: Page, code: string) {
  await page.getByRole('button', { name: 'Add promo code' }).click()
  await promoField(page).fill(code)
  await page.getByRole('button', { name: 'Apply' }).click()
}

test('applies a valid code: its row, its removable chip, and the new total', async ({
  page,
  cloud,
  signIn
}) => {
  quoteCodes(cloud)
  await signIn(CHECKOUT)
  await expect(page.getByText(EYEBROW)).toBeVisible()

  await enterCode(page, 'launch20')

  await expect(summary(page)).toContainText('Promo code−$10.00')
  await expect(summary(page)).toContainText('Total due today$40.00')
  await expect(
    page.getByRole('button', { name: 'Remove LAUNCH20' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add promo code' })
  ).toBeHidden()

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()
  await expect
    .poll(() =>
      cloud.requests.find((request) => request.path === '/billing/subscribe')
    )
    .toMatchObject({
      body: { promotion_code: 'LAUNCH20', quote_id: 'quote_launch20' }
    })
})

test('an invalid code says so under the field and leaves the total alone', async ({
  page,
  cloud,
  signIn
}) => {
  quoteCodes(cloud)
  await signIn(CHECKOUT)
  await expect(page.getByText(EYEBROW)).toBeVisible()

  await enterCode(page, 'NOPE')

  await expect(page.getByText("This code isn't valid.")).toBeVisible()
  await expect(promoField(page)).toHaveValue('NOPE')
  await expect(summary(page)).toContainText('Total due today$50.00')
  await expect(summary(page)).not.toContainText('−$')
})

test('a code in the URL is prefilled and priced only on Apply', async ({
  page,
  cloud,
  signIn
}) => {
  quoteCodes(cloud)
  await signIn(
    entryPath('checkout', { plan: 'pro_monthly', promo: 'LAUNCH20' })
  )
  await expect(page.getByText(EYEBROW)).toBeVisible()

  await expect(promoField(page)).toHaveValue('LAUNCH20')
  await expect(summary(page)).toContainText('Total due today$50.00')
  const quotes = cloud.requests.filter(
    (request) => request.path === '/billing/preview-subscribe'
  )
  expect(quotes.map((request) => request.body)).not.toContainEqual(
    expect.objectContaining({ promotion_code: expect.anything() })
  )

  await page.getByRole('button', { name: 'Apply' }).click()

  await expect(summary(page)).toContainText('Total due today$40.00')
})

test('a Pay over the URL code prices it first, and the second Pay charges the new total', async ({
  page,
  cloud,
  signIn
}) => {
  quoteCodes(cloud)
  await signIn(
    entryPath('checkout', { plan: 'pro_monthly', promo: 'LAUNCH20' })
  )
  await expect(promoField(page)).toHaveValue('LAUNCH20')
  const pay = page.getByRole('button', { name: 'Pay and subscribe' })

  await pay.click()

  await expect(summary(page)).toContainText('Total due today$40.00')
  await expect(
    page.getByRole('button', { name: 'Remove LAUNCH20' })
  ).toBeVisible()
  expect(
    cloud.requests.some((request) => request.path === '/billing/subscribe')
  ).toBe(false)

  await pay.click()

  await expect
    .poll(() =>
      cloud.requests.find((request) => request.path === '/billing/subscribe')
    )
    .toMatchObject({
      body: { promotion_code: 'LAUNCH20', quote_id: 'quote_launch20' }
    })
})

test('a URL code the link cannot carry loads the checkout with the code refused in the field', async ({
  page,
  cloud,
  signIn
}) => {
  quoteCodes(cloud)
  await signIn(entryPath('checkout', { plan: 'pro_monthly', promo: 'SAVE 20' }))

  await expect(page.getByText(EYEBROW)).toBeVisible()
  await expect(promoField(page)).toHaveValue('SAVE 20')
  await expect(page.getByText("This code isn't valid.")).toBeVisible()
  await expect(summary(page)).toContainText('Total due today$50.00')
})

test('a code that lapses before Pay returns to capture with the expired card', async ({
  page,
  cloud,
  signIn
}) => {
  let stillValid = true
  quoteCodes(cloud, () => stillValid)
  cloud.reply('POST', '/billing/subscribe', () => ({
    status: 400,
    body: {
      code: 'SUBSCRIPTION_QUOTE_STALE',
      message: 'subscription quote is stale or does not match this request'
    }
  }))
  await signIn(CHECKOUT)
  await enterCode(page, 'LAUNCH20')
  await expect(summary(page)).toContainText('Total due today$40.00')
  stillValid = false

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  const card = page.getByRole('alert')
  await expect(card).toContainText('Your promo code expired')
  await expect(card).toContainText(
    'The LAUNCH20 code expired, so the total was updated.'
  )
  await expect(summary(page)).toContainText('Total due today$50.00')
  await expect(
    page.getByRole('button', { name: 'Remove LAUNCH20' })
  ).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Add promo code' })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Pay and subscribe' })
  ).toBeEnabled()
  await expect(page.getByRole('link', { name: 'Contact support' })).toBeHidden()
})

test('a code applied here survives a reload, still applied at the discounted price', async ({
  page,
  cloud,
  signIn
}) => {
  quoteCodes(cloud)
  await signIn(CHECKOUT)
  await enterCode(page, 'LAUNCH20')
  await expect(summary(page)).toContainText('Total due today$40.00')

  await page.reload()

  await expect(summary(page)).toContainText('Promo code−$10.00')
  await expect(summary(page)).toContainText('Total due today$40.00')
  await expect(
    page.getByRole('button', { name: 'Remove LAUNCH20' })
  ).toBeVisible()
})

test('a restored code the server now refuses shows the expired card at the full price', async ({
  page,
  cloud,
  signIn
}) => {
  let stillValid = true
  quoteCodes(cloud, () => stillValid)
  await signIn(CHECKOUT)
  await enterCode(page, 'LAUNCH20')
  await expect(summary(page)).toContainText('Total due today$40.00')
  stillValid = false

  await page.reload()

  const card = page.getByRole('alert')
  await expect(card).toContainText('Your promo code expired')
  await expect(card).toContainText(
    'The LAUNCH20 code expired, so the total was updated.'
  )
  await expect(summary(page)).toContainText('Total due today$50.00')
  await expect(
    page.getByRole('button', { name: 'Add promo code' })
  ).toBeEnabled()
})

test('a copied checkout URL carries no applied code', async ({
  page,
  context,
  cloud,
  signIn
}) => {
  quoteCodes(cloud)
  await signIn(CHECKOUT)
  await enterCode(page, 'LAUNCH20')
  await expect(summary(page)).toContainText('Total due today$40.00')

  const copied = page.url()
  expect(copied).not.toMatch(/launch20/i)
  const pasted = await context.newPage()
  await pasted.goto(copied)

  await expect(pasted.getByText(EYEBROW)).toBeVisible()
  await expect(summary(pasted)).toContainText('Total due today$50.00')
  await expect(
    pasted.getByRole('button', { name: 'Add promo code' })
  ).toBeVisible()
})

test('discount rows follow the server order, the entered code first when it comes first', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.reply('POST', '/billing/preview-subscribe', ({ body }) => {
    const entered =
      typeof body === 'object' && body !== null && 'promotion_code' in body
    if (!entered) return { body: cloud.scenario.preview }
    return {
      body: {
        ...cloud.scenario.preview,
        quote_id: 'quote_launch20',
        amount_due_cents: 3000,
        promotion_code: 'LAUNCH20',
        discounts: [
          { kind: 'promotion', code: 'LAUNCH20', amount_off_cents: 1000 },
          {
            kind: 'promotion',
            code: 'COMFY-EDU',
            name: 'Education discount',
            amount_off_cents: 1000
          }
        ]
      }
    }
  })
  await signIn(CHECKOUT)

  await enterCode(page, 'LAUNCH20')

  await expect(summary(page)).toContainText(
    'Promo code−$10.00Education discount−$10.00'
  )
  await expect(
    page.getByRole('button', { name: 'Remove LAUNCH20' })
  ).toBeVisible()
})
