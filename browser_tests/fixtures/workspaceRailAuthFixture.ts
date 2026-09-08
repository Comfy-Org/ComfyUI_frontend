import { test as base } from '@playwright/test'

import type { operations } from '@/types/comfyRegistryTypes'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  createSubscriptionHelper,
  withUnsubscribed
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import type { SubscriptionOperator } from '@e2e/fixtures/helpers/SubscriptionHelper'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

// The subscription fixture pins billing_rail to legacy_stripe, which routes
// local billing through the legacy rail and its Local exemption from the
// subscription gate. The 1.51 QA finding #11 (no way to add credits without
// an active subscription) only reproduces on the workspace rail, so this
// fixture overrides the rail; localAuthFixture keeps the legacy-rail
// coverage.
const onWorkspaceRail: SubscriptionOperator = (config) => ({
  ...config,
  status: { ...config.status, billing_rail: 'stripe' }
})

/**
 * Boots the local (non-Cloud) build as a logged-in unsubscribed workspace
 * owner on the workspace billing rail. See localAuthFixture for the boot
 * ordering constraints this mirrors.
 */
export const workspaceRailAuthFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page, request }, use, testInfo) => {
    testInfo.setTimeout(45_000)

    const comfyPage = new ComfyPage(page, request)
    const userId = await comfyPage.setupUser(
      `playwright-workspace-rail-${testInfo.parallelIndex}`
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
    await page.route('**/api/billing/balance', (route) =>
      route.fulfill({
        json: { amount_micros: 0, currency: 'usd', effective_balance_micros: 0 }
      })
    )
    const subscriptionHelper = createSubscriptionHelper(
      page,
      withUnsubscribed(),
      onWorkspaceRail
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
