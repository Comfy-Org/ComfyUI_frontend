import { E2E_FIREBASE_CONFIG, E2E_USER } from './fixtures/env'
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

test('an account its SSO organization holds is offered Continue with SSO, which leaves for that organization and back to the product', async ({
  page,
  cloud
}) => {
  cloud.reply('GET', '/features', () => ({
    body: { firebase_config: E2E_FIREBASE_CONFIG, sso_enabled: true }
  }))
  cloud.reply('POST', '/auth/token', () => ({
    status: 403,
    body: {
      code: 'sso_required',
      message: 'sign in with your organization',
      organization_id: 'org_e2e'
    }
  }))
  await page.goto(entryPath('subscription', { return_to: 'comfyui_credits' }))
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(E2E_USER.email)
  await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText(
    'Your organization requires single sign-on'
  )
  const signInPage = page.url()
  await page.getByRole('button', { name: 'Continue with SSO' }).click()

  await page.waitForURL((url) => url.pathname === '/api/auth/sso/start')
  const start = new URL(page.url())
  expect(start.origin).toBe('https://testcloud.comfy.org')
  expect(Object.fromEntries(start.searchParams)).toStrictEqual({
    email: E2E_USER.email,
    organization: 'org_e2e',
    return_to: signInPage
  })
})
