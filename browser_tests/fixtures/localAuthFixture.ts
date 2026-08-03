import { test as base } from '@playwright/test'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { operations } from '@/types/comfyRegistryTypes'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'

type CustomerBalanceResponse = NonNullable<
  operations['GetCustomerBalance']['responses']['200']['content']['application/json']
>

const LOCAL_AUTH_BOOT_TIMEOUT = 45_000

/**
 * Boots the local (non-Cloud) build as a logged-in, legacy Free-tier user.
 *
 * Firebase auth must be seeded via `ComfyPage.cloudAuth` *before* the app's
 * first navigation: seeding it against an already-booted page races the
 * app's own Firebase listener and can hang indefinitely. `comfyPageFixture`
 * only seeds pre-boot for `@cloud`-tagged tests (which also run against the
 * Cloud-distribution build), so specs that need an authenticated local user
 * construct `ComfyPage` directly here and drive its setup themselves,
 * mirroring `ComfyPage.setup()` but with auth mocked first.
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
    const freeTierStatus: CloudSubscriptionStatusResponse = {
      is_active: true,
      subscription_id: null,
      subscription_tier: 'FREE',
      subscription_duration: null,
      renewal_date: null,
      end_date: null
    }
    const zeroBalance: CustomerBalanceResponse = {
      amount_micros: 0,
      effective_balance_micros: 0,
      prepaid_balance_micros: 0,
      cloud_credit_balance_micros: 0,
      pending_charges_micros: 0,
      currency: 'USD'
    }
    await page.route('**/customers/cloud-subscription-status', (route) =>
      route.fulfill({ json: freeTierStatus })
    )
    await page.route('**/customers/balance', (route) =>
      route.fulfill({ json: zeroBalance })
    )

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
