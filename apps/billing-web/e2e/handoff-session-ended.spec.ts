import { E2E_USER } from './fixtures/env'
import { expect, test } from './fixtures/test'

const REFUSALS = [
  {
    name: 'turns billing from this app off',
    status: 403,
    code: 'HANDOFF_DISABLED'
  },
  { name: 'ends the scoped session', status: 401, code: 'INVALID_CREDENTIAL' }
]

for (const { name, status, code } of REFUSALS) {
  test(`a handoff tab shows the session has ended, without an error, when Cloud ${name} mid-session`, async ({
    page,
    cloud
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !message.text().startsWith('Failed to load resource')
      )
        pageErrors.push(message.text())
    })
    cloud.reply('POST', '/auth/handoffs/exchange', () => ({
      body: {
        session_token: 'handoff-scoped-session',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        user: { id: E2E_USER.uid, email: E2E_USER.email },
        workspace: { id: E2E_USER.workspaceId, name: 'Acme', type: 'team' },
        role: 'owner'
      }
    }))
    await page.goto('/handoff?intent=subscription#token=one-time-token')
    await expect(
      page.getByRole('button', { name: 'Cancel subscription' })
    ).toBeVisible()

    cloud.reply('GET', '/billing/status', () => ({
      status,
      body: { code, message: 'Refused' }
    }))
    await page.getByRole('button', { name: 'Cancel subscription' }).click()
    await page.getByRole('button', { name: 'Confirm cancellation' }).click()

    await expect(
      page.getByRole('heading', { name: 'This checkout session has ended' })
    ).toBeVisible()
    await expect(page).toHaveURL(/\/handoff$/)
    expect(pageErrors).toEqual([])
  })
}
