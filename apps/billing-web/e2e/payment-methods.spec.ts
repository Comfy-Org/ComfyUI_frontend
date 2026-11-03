import { PORTAL_URL } from './fixtures/env'
import { entryPath, expect, test } from './fixtures/test'

const PAYMENT_METHODS = entryPath('payment-methods')

test('hands the visitor to the payment portal as soon as the page opens', async ({
  page,
  signIn
}) => {
  await signIn(PAYMENT_METHODS)

  await page.waitForURL(PORTAL_URL)
})

test('stays put after the portal sends the visitor back and offers it again', async ({
  page,
  signIn
}) => {
  await signIn(entryPath('payment-methods', { portal: 'return' }))

  const manage = page.getByRole('button', { name: 'Manage payment methods' })
  await expect(manage).toBeVisible()
  await expect(page).not.toHaveURL(/portal=return/)

  await manage.click()

  await page.waitForURL(PORTAL_URL)
})
