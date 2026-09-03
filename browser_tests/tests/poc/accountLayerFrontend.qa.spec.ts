import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

interface AccountLayerDebug {
  billingRequests: number
  sessionExchanges: number
  lastBillingToken: string | null
  lastSessionToken: string | null
}

test('uses the account package for session and credits', async ({
  comfyPage
}) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) throw new Error('E2E credentials are unavailable')

  await comfyPage.page.goto('/cloud/login')
  await comfyPage.page.getByLabel(/email/i).fill(email)
  await comfyPage.page.getByLabel(/password/i).fill(password)
  await comfyPage.page.getByRole('button', { name: /sign in|log in/i }).click()

  const credits = comfyPage.page.getByTestId('account-layer-poc')
  await expect(credits).toHaveText(/\d+/, { timeout: 30_000 })
  const initial = await comfyPage.page.evaluate(
    () => Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
  )
  expect(initial.sessionExchanges).toBeGreaterThan(0)
  expect(initial.billingRequests).toBeGreaterThan(0)
  expect(initial.lastBillingToken).toBe(initial.lastSessionToken)

  await comfyPage.page.clock.install()
  await comfyPage.page.clock.runFor(55 * 60 * 1000)
  await expect
    .poll(
      async () =>
        await comfyPage.page.evaluate(
          () =>
            (Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug)
              .sessionExchanges
        )
    )
    .toBeGreaterThan(initial.sessionExchanges)

  await comfyPage.page.getByRole('button', { name: /account|profile/i }).click()
  await comfyPage.page
    .getByRole('menuitem', { name: /sign out|log out/i })
    .click()
  await expect(comfyPage.page).toHaveURL(/\/cloud\/login/)
  await expect(credits).toBeHidden()
})
