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

test('names the plan and the workspace, and enables Pay once the form is ready', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(CHECKOUT)

  await expect(page.getByText(EYEBROW)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Pay and subscribe' })
  ).toBeEnabled()
  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeHidden()
  expect(
    cloud.requests.some((request) => request.path === '/billing/capabilities')
  ).toBe(true)
})

test('a payment form that fails to load is replaced, and Try again remounts it', async ({
  page,
  signIn
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { __e2eStripeLoadErrors: 1 })
  })
  await signIn(CHECKOUT)

  await expect(page.getByText("The payment form couldn't load")).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Pay and subscribe' })
  ).toBeHidden()
  await expect(page.getByText(EYEBROW)).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(
    page.getByRole('button', { name: 'Pay and subscribe' })
  ).toBeEnabled()
  await expect(page.getByText("The payment form couldn't load")).toBeHidden()
})
