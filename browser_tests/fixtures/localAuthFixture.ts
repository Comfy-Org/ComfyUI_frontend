import { test as base } from '@playwright/test'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  createSubscriptionHelper,
  withFreeTier
} from '@e2e/fixtures/helpers/SubscriptionHelper'

const LOCAL_AUTH_BOOT_TIMEOUT = 45_000

/**
 * Boots the local (non-Cloud) build as a logged-in, legacy Free-tier user.
 *
 * Firebase auth must be seeded via `ComfyPage.cloudAuth` *before* the app's
 * first navigation: seeding it against an already-booted page races the
 * app's own Firebase listener and can hang indefinitely. `comfyPageFixture`
 * seeds pre-boot for `@cloud`- and `@auth`-tagged tests. Prefer tagging a
 * spec `@auth` over using this fixture; it exists for specs that also need
 * the Free-tier subscription mocks and the bespoke boot below.
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
    const subscriptionHelper = createSubscriptionHelper(page, withFreeTier())
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
