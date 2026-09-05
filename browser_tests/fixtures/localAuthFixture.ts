import { test as base } from '@playwright/test'

import type { operations } from '@/types/comfyRegistryTypes'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  createSubscriptionHelper,
  withUnsubscribed
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

const LOCAL_AUTH_BOOT_TIMEOUT = 45_000
type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

/**
 * Boots the local (non-Cloud) build as a logged-in unsubscribed workspace owner.
 *
 * Firebase auth must be seeded via `ComfyPage.cloudAuth` *before* the app's
 * first navigation: seeding it against an already-booted page races the
 * app's own Firebase listener and can hang indefinitely. `comfyPageFixture`
 * seeds pre-boot for `@cloud`- and `@auth`-tagged tests. Prefer tagging a
 * spec `@auth` over using this fixture; it exists for specs that also need
 * the unsubscribed billing mocks and the bespoke boot below.
 */
export const localAuthFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page, request }, use, testInfo) => {
    testInfo.setTimeout(LOCAL_AUTH_BOOT_TIMEOUT)

    const comfyPage = new ComfyPage(page, request)
    const userId = await comfyPage.setupUser(
      `playwright-local-auth-${testInfo.parallelIndex}`
    )
    await comfyPage.setupSettings({
      'Comfy.TutorialCompleted': true,
      'Comfy.userId': userId
    })

    await comfyPage.cloudAuth.mockAuth()
    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await page.route('**/customers', (route) =>
      route.fulfill({
        status: 201,
        json: { id: 'test-user-e2e' } satisfies CreateCustomerResponse
      })
    )
    const subscriptionHelper = createSubscriptionHelper(
      page,
      withUnsubscribed()
    )
    await subscriptionHelper.mock()

    await page.evaluate((id) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('Comfy.userId', id)
    }, userId)

    await comfyPage.goto()
    await page.waitForFunction(() => document.fonts.ready)
    await comfyPage.waitForAppReady()

    await use(comfyPage)
    await subscriptionHelper.clearMocks()
  }
})
