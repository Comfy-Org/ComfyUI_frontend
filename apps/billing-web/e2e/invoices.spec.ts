import { E2E_ORIGIN, PORTAL_URL } from './fixtures/env'
import { entryPath, expect, test } from './fixtures/test'

test('opens the provider portal for invoices, returning to this page', async ({
  page,
  cloud,
  signIn
}) => {
  const invoices = entryPath('invoices')
  await signIn(invoices)
  await expect(
    page.getByText('Invoices and receipts are kept by our payment provider.', {
      exact: false
    })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Open invoices' }).click()

  await page.waitForURL(PORTAL_URL)
  const portal = cloud.requests.find(
    (request) => request.path === '/billing/payment-portal'
  )
  expect(portal?.body).toStrictEqual({ return_url: `${E2E_ORIGIN}${invoices}` })
})
