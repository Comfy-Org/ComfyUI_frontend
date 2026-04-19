import { expect } from '@playwright/test'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  createSubscriptionHelper,
  withActiveSubscription,
  withFreeTier,
  withUnsubscribed
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import type { SubscriptionHelper } from '@e2e/fixtures/helpers/SubscriptionHelper'

// Installs subscription mocks BEFORE comfyPage's first navigation via an
// auto-fixture that depends on `page` (resolved before `comfyPage`).
function createSubscriptionTest(
  ...defaultOps: Parameters<typeof createSubscriptionHelper>[1][]
) {
  return comfyPageFixture.extend<{
    subscriptionHelper: SubscriptionHelper
    _subscriptionMocks: void
  }>({
    subscriptionHelper: async ({ page }, use) => {
      const helper = createSubscriptionHelper(page, ...defaultOps)
      await use(helper)
      await helper.clearMocks()
    },
    _subscriptionMocks: [
      async ({ subscriptionHelper }, use) => {
        await subscriptionHelper.mock()
        await use()
      },
      { auto: true }
    ]
  })
}

const unsubscribedTest = createSubscriptionTest(withUnsubscribed())
const subscribedTest = createSubscriptionTest(withActiveSubscription('CREATOR'))
const freeTierTest = createSubscriptionTest(withFreeTier())

unsubscribedTest.describe(
  'Subscription buttons — unsubscribed',
  { tag: '@cloud' },
  () => {
    unsubscribedTest(
      'SubscribeToRun visible when unsubscribed',
      async ({ comfyPage }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeVisible({ timeout: 10_000 })
      }
    )

    unsubscribedTest(
      'SubscribeToRun click opens subscription dialog',
      async ({ comfyPage }) => {
        await comfyPage.page
          .getByTestId(TestIds.topbar.subscribeToRunButton)
          .click()
        await expect(comfyPage.page.getByRole('dialog')).toBeVisible({
          timeout: 10_000
        })
      }
    )

    unsubscribedTest(
      'SubscribeToRun shows short label on mobile',
      { tag: '@mobile' },
      async ({ comfyPage }) => {
        const btn = comfyPage.page.getByTestId(
          TestIds.topbar.subscribeToRunButton
        )
        await expect(btn).toBeVisible({ timeout: 10_000 })
        await expect(btn).not.toContainText(/to run/i)
      }
    )

    unsubscribedTest(
      'User popover shows subscribe when unsubscribed',
      async ({ comfyPage }) => {
        await comfyPage.page
          .getByTestId(TestIds.user.currentUserIndicator)
          .click()
        const popover = comfyPage.page.locator('.current-user-popover')
        await expect(
          popover.getByRole('button', { name: /subscribe/i })
        ).toBeVisible({ timeout: 10_000 })
      }
    )

    unsubscribedTest(
      'User popover subscribe click opens dialog',
      async ({ comfyPage }) => {
        await comfyPage.page
          .getByTestId(TestIds.user.currentUserIndicator)
          .click()
        const popover = comfyPage.page.locator('.current-user-popover')
        await popover
          .getByRole('button', { name: /subscribe/i })
          .first()
          .click()
        await expect(comfyPage.page.getByRole('dialog')).toBeVisible({
          timeout: 10_000
        })
      }
    )

    unsubscribedTest(
      'Subscription state transition updates UI after re-fetch',
      async ({ comfyPage, subscriptionHelper }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeVisible({ timeout: 10_000 })

        // Simulate returning from Stripe checkout: seed pending checkout,
        // mutate mock to return active subscription, trigger re-fetch.
        await subscriptionHelper.seedPendingCheckout('standard', 'monthly')
        subscriptionHelper.setStatus({
          is_active: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
        await subscriptionHelper.triggerSubscriptionRefetch()

        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).not.toBeVisible({ timeout: 10_000 })
      }
    )

    unsubscribedTest(
      'Cleanup prevents stale subscription state after dialog close',
      async ({ comfyPage, subscriptionHelper }) => {
        // Open popover → click subscribe → dialog opens, isAwaitingStripeSubscription = true
        await comfyPage.page
          .getByTestId(TestIds.user.currentUserIndicator)
          .click()
        const popover = comfyPage.page.locator('.current-user-popover')
        await popover
          .getByRole('button', { name: /subscribe/i })
          .first()
          .click()
        const dialog = comfyPage.page.getByRole('dialog')
        await expect(dialog).toBeVisible({ timeout: 10_000 })

        // Close dialog → SubscribeButton unmounts → onBeforeUnmount resets ref
        await dialog.getByRole('button', { name: /close/i }).first().click()
        await expect(dialog).not.toBeVisible({ timeout: 10_000 })

        // Now change subscription state — the unmounted SubscribeButton's watcher
        // should not fire because isAwaitingStripeSubscription was reset.
        await subscriptionHelper.seedPendingCheckout('standard', 'monthly')
        subscriptionHelper.setStatus({
          is_active: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
        await subscriptionHelper.triggerSubscriptionRefetch()

        // No dialog should reappear from the stale SubscribeButton state
        await expect(dialog).not.toBeVisible({ timeout: 2_000 })
      }
    )
  }
)

subscribedTest.describe(
  'Subscription buttons — subscribed',
  { tag: '@cloud' },
  () => {
    subscribedTest(
      'SubscribeToRun hidden when subscribed',
      async ({ comfyPage }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.queueButton)
        ).toBeVisible({ timeout: 10_000 })
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeHidden()
      }
    )

    subscribedTest(
      'Topbar subscribe button hidden for paid tier',
      async ({ comfyPage }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.queueButton)
        ).toBeVisible({ timeout: 10_000 })
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeButton)
        ).toBeHidden()
      }
    )
  }
)

freeTierTest.describe(
  'Subscription buttons — free tier',
  { tag: '@cloud' },
  () => {
    freeTierTest(
      'Topbar subscribe button visible for free tier',
      async ({ comfyPage }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeButton)
        ).toBeVisible({ timeout: 10_000 })
      }
    )
  }
)
