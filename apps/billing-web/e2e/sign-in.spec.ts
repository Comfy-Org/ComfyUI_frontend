import { entryPath, expect, test } from './fixtures/test'

test('an entry link without a session goes through sign-in and comes back to the intent', async ({
  page,
  cloud,
  signIn
}) => {
  const subscription = entryPath('subscription')

  await signIn(subscription)

  await expect(
    page.getByRole('heading', { name: 'Your subscription' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Return to ComfyUI' })
  ).toHaveAttribute('href', 'https://testcloud.comfy.org/?workspace=ws_e2e')
  await expect(page.getByText('Current plan: Creator · Monthly')).toBeVisible()
  const mint = cloud.requests.find((request) => request.path === '/auth/token')
  expect(mint?.authorization).toBe('Bearer e2e-firebase-id-token')
  expect(mint?.body).toStrictEqual({})
  const read = cloud.requests.find(
    (request) => request.path === '/billing/plans'
  )
  expect(read?.authorization).toBe('Bearer e2e-workspace-jwt')
})

test('a returning visitor is restored without seeing the form', async ({
  page,
  signIn
}) => {
  const subscription = entryPath('subscription')
  await signIn(subscription)

  await page.reload()

  await expect(
    page.getByRole('heading', { name: 'Your subscription' })
  ).toBeVisible()
  await expect(page).toHaveURL(subscription)
})
