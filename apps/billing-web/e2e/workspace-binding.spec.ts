import { E2E_USER } from './fixtures/env'
import { entryPath, expect, test } from './fixtures/test'

test('an entry link naming a workspace mints for it, names it in the shell, and returns into it', async ({
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
    workspace: 'ws_team_e2e'
  })

  await signIn(subscription)

  await expect(page.getByText('Billing for Acme Team')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Return to ComfyUI' })
  ).toHaveAttribute(
    'href',
    'https://testcloud.comfy.org/?workspace=ws_team_e2e'
  )
  const mint = cloud.requests.find((request) => request.path === '/auth/token')
  expect(mint?.body).toStrictEqual({ workspace_id: 'ws_team_e2e' })
})

const REFUSAL_CASES = [
  {
    name: 'a workspace this account is barred from',
    status: 403,
    message: "This account can't manage billing for that workspace."
  },
  {
    name: 'a workspace this account is not a member of',
    status: 404,
    message:
      "This account can't access that workspace. Reopen billing from the app while signed in with the right account."
  }
] as const

for (const { name, status, message } of REFUSAL_CASES) {
  test(`a mint the server refuses for ${name} surfaces that reason, never the personal workspace`, async ({
    page,
    cloud
  }) => {
    cloud.reply('POST', '/auth/token', () => ({
      status,
      body: { error: 'refused' }
    }))
    const subscription = entryPath('subscription', {
      workspace: 'ws_not_a_member'
    })

    await page.goto(subscription)
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/)
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(E2E_USER.email)
    await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByRole('alert')).toContainText(message)
    const mint = cloud.requests.find(
      (request) => request.path === '/auth/token'
    )
    expect(mint?.body).toStrictEqual({ workspace_id: 'ws_not_a_member' })
    expect(
      cloud.requests.some((request) => request.path.startsWith('/billing/')),
      'a refused mint must never fall through to a personal-workspace read'
    ).toBe(false)
  })
}
