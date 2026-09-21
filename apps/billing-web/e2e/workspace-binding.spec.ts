import { E2E_USER } from './fixtures/env'
import { entryPath, expect, test } from './fixtures/test'

test('an entry link naming a workspace mints for it and names it in the shell', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.reply('POST', '/auth/token', () => ({
    body: {
      token: 'e2e-team-jwt',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      permissions: ['workspace:read', 'billing:write'],
      role: 'owner',
      workspace: { id: 'ws_team_e2e', name: 'Acme Team', type: 'team' }
    }
  }))
  const subscription = entryPath('subscription', {
    workspace_id: 'ws_team_e2e'
  })

  await signIn(subscription)

  await expect(page.getByText('Billing for Acme Team')).toBeVisible()
  const mint = cloud.requests.find((request) => request.path === '/auth/token')
  expect(mint?.body).toStrictEqual({ workspace_id: 'ws_team_e2e' })
})

test('a mint the server refuses for a named workspace surfaces that reason, never the personal workspace', async ({
  page,
  cloud
}) => {
  cloud.reply('POST', '/auth/token', () => ({
    status: 403,
    body: { error: 'ACCESS_DENIED' }
  }))
  const subscription = entryPath('subscription', {
    workspace_id: 'ws_not_a_member'
  })

  await page.goto(subscription)
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/)
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(E2E_USER.email)
  await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText(
    "This account can't manage billing for that workspace."
  )
  const mint = cloud.requests.find((request) => request.path === '/auth/token')
  expect(mint?.body).toStrictEqual({ workspace_id: 'ws_not_a_member' })
  expect(
    cloud.requests.some((request) => request.path.startsWith('/billing/')),
    'a refused mint must never fall through to a personal-workspace read'
  ).toBe(false)
})
