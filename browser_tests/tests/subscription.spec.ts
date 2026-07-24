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

// Installs subscription mocks AFTER comfyPage.setup() and reloads the page
// so `addInitScript` (which sets `window.__CONFIG__.subscription_required`)
// applies before module-level reads in `ComfyRunButton/index.ts` evaluate.
function createSubscriptionTest(
  ...defaultOps: Parameters<typeof createSubscriptionHelper>[1][]
) {
  return comfyPageFixture.extend<{
    subscriptionHelper: SubscriptionHelper
  }>({
    subscriptionHelper: [
      async ({ comfyPage }, use) => {
        const helper = createSubscriptionHelper(comfyPage.page, ...defaultOps)
        await helper.mock()
        // Disable the cloud-subscription extension so its `requireActiveSubscription`
        // watcher doesn't auto-open the subscription dialog on app boot.
        await comfyPage.setupSettings({
          'Comfy.Extension.Disabled': ['Comfy.Cloud.Subscription']
        })
        await comfyPage.page.reload()
        // Firebase auth resolves asynchronously after app boot — wait for the
        // user button (v-if="isLoggedIn") before any test body interacts with it.
        await expect(
          comfyPage.page.getByTestId(TestIds.user.currentUserButton)
        ).toBeVisible()
        // Defense-in-depth: dismiss the dialog if it surfaces via a different code path.
        await helper.dismissSubscriptionDialogIfOpen()
        await use(helper)
        await helper.clearMocks()
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
        ).toBeVisible()
      }
    )

    unsubscribedTest(
      'SubscribeToRun click opens subscription dialog',
      async ({ comfyPage }) => {
        await comfyPage.page
          .getByTestId(TestIds.topbar.subscribeToRunButton)
          .click()
        await expect(
          comfyPage.page.locator('[aria-labelledby="subscription-required"]')
        ).toBeVisible()
      }
    )

    unsubscribedTest(
      'SubscribeToRun shows short label at narrow viewport',
      { tag: '@mobile' },
      async ({ comfyPage }) => {
        await comfyPage.page.setViewportSize({ width: 393, height: 851 })
        const btn = comfyPage.page.getByTestId(
          TestIds.topbar.subscribeToRunButton
        )
        await expect(btn).toBeVisible()
        await expect(btn).not.toContainText(/to run/i)
      }
    )

    unsubscribedTest(
      'User popover shows subscribe when unsubscribed',
      async ({ subscriptionHelper }) => {
        const popover = await subscriptionHelper.openUserPopover()
        await expect(
          popover.getByRole('button', { name: /subscribe/i })
        ).toBeVisible()
      }
    )

    unsubscribedTest(
      'User popover subscribe click opens dialog',
      async ({ comfyPage, subscriptionHelper }) => {
        await subscriptionHelper.clickPopoverSubscribe()
        await expect(
          comfyPage.page.locator('[aria-labelledby="subscription-required"]')
        ).toBeVisible()
      }
    )

    unsubscribedTest(
      'Subscription state transition updates UI after re-fetch',
      async ({ comfyPage, subscriptionHelper }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeVisible()

        await subscriptionHelper.seedPendingCheckout('standard', 'monthly')
        subscriptionHelper.setStatus({
          is_active: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
        await subscriptionHelper.triggerSubscriptionRefetch()

        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeHidden()
      }
    )

    unsubscribedTest(
      'Cleanup prevents stale subscription state after dialog close',
      async ({ comfyPage, subscriptionHelper }) => {
        await subscriptionHelper.clickPopoverSubscribe()
        const dialog = comfyPage.page.locator(
          '[aria-labelledby="subscription-required"]'
        )
        await expect(dialog).toBeVisible()

        await dialog.getByRole('button', { name: /close/i }).first().click()
        await expect(dialog).toBeHidden()

        await subscriptionHelper.seedPendingCheckout('standard', 'monthly')
        subscriptionHelper.setStatus({
          is_active: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
        await subscriptionHelper.triggerSubscriptionRefetch()

        await expect(dialog).toBeHidden()
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeHidden()
      }
    )
  }
)

subscribedTest.describe(
  'Subscription buttons — subscribed',
  { tag: '@cloud' },
  () => {
    subscribedTest(
      'Queue button visible and subscribe buttons hidden when subscribed',
      async ({ comfyPage }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.queueButton)
        ).toBeVisible()
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeHidden()
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
        ).toBeVisible()
      }
    )
  }
)
