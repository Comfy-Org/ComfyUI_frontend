import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import type { operations } from '@/types/comfyRegistryTypes'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

const LOCAL_AUTH_BOOT_TIMEOUT = 45_000
type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

/**
 * Boots the local (non-Cloud) build as a *signed-out* workspace owner: a
 * real ComfyUI multi-user profile is created (so the app reaches the main
 * UI instead of the profile picker), but Firebase auth is never seeded.
 *
 * `localAuthFixture` covers the opposite case — already signed in via
 * `cloudAuth.mockAuth()`. This fixture is for specs that drive the sign-in
 * dialog's own credential flow (`showSignInDialog()`), where a pre-seeded
 * session would skip the very thing under test.
 */
export const localSignedOutFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page, request }, use, testInfo) => {
    testInfo.setTimeout(LOCAL_AUTH_BOOT_TIMEOUT)

    const comfyPage = new ComfyPage(page, request)
    const userId = await comfyPage.setupUser(
      `playwright-signed-out-${testInfo.parallelIndex}`
    )
    await comfyPage.setupSettings({ userId })

    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await mockBilling(page)
    await page.route('https://{api,stagingapi}.comfy.org/releases**', (route) =>
      route.fulfill({ json: [] })
    )
    await page.route('**/customers', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        json: { id: 'test-user-e2e' } satisfies CreateCustomerResponse
      })
    })

    await page.goto(`${comfyPage.apiUrl}/api/users`)
    await page.evaluate((id) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('Comfy.userId', id)
    }, userId)

    await comfyPage.goto()
    await page.waitForFunction(() => document.fonts.ready)
    await comfyPage.waitForAppReady()

    await use(comfyPage)
  }
})
