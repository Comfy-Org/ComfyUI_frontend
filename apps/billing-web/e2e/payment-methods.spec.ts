import { PORTAL_URL } from './fixtures/env'
import { entryPath, expect, test } from './fixtures/test'

const PAYMENT_METHODS = entryPath('payment-methods')

test('lists the saved cards the server holds and marks the default', async ({
  page,
  signIn
}) => {
  await signIn(PAYMENT_METHODS)

  const card = page.getByRole('listitem').filter({ hasText: 'visa •••• 4242' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Default')).toBeVisible()
})

test('says when no card is saved and still offers the portal', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  await signIn(PAYMENT_METHODS)

  await expect(
    page.getByText('No payment method is saved for this workspace.')
  ).toBeVisible()

  await page.getByRole('button', { name: 'Manage payment methods' }).click()

  await page.waitForURL(PORTAL_URL)
})
