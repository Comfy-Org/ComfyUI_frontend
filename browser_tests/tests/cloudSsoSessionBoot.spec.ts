import { expect } from '@playwright/test'

import { SSO_WEB_SESSION } from '@e2e/fixtures/data/sso'
import { webSessionTest } from '@e2e/fixtures/webSessionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/** The session of a person who signed in through their organization's SSO. */
const test = webSessionTest.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/auth/session', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill(jsonRoute(SSO_WEB_SESSION))
    })
    await use(page)
  }
})

test.describe(
  'Cloud boot on an SSO session',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test.use({
      firebaseLogin: false,
      serverFeatures: { sso_enabled: true }
    })

    test('a session-only SSO user boots into the app as the session user, with no Firebase traffic', async ({
      comfyPage,
      firebaseRequests
    }) => {
      const page = comfyPage.page
      await comfyPage.waitForAppReady()
      expect(page.url()).not.toContain('/cloud/login')

      await comfyPage.toast.closeToasts()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Current user' }).click()
      await expect(page.getByText(SSO_WEB_SESSION.user.email)).toBeVisible()

      expect(
        await page.evaluate(() =>
          localStorage.getItem('Comfy.WebSession.SsoHint')
        ),
        'the SSO session leaves its email for a later SSO re-entry'
      ).toBe(JSON.stringify({ email: SSO_WEB_SESSION.user.email }))
      expect(firebaseRequests).toEqual([])
    })
  }
)
