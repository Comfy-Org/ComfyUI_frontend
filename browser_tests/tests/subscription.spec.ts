import { expect } from '@playwright/test'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  createSubscriptionHelper,
  withActiveSubscription,
  withFreeTier,
  withFreeTierEnabled,
  withUnsubscribed
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import type { SubscriptionHelper } from '@e2e/fixtures/helpers/SubscriptionHelper'
import { expectPlatformPlansOpened } from '@e2e/fixtures/utils/platformPlans'

// oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
// Installs subscription mocks AFTER comfyPage.setup() and reloads the page
// so `addInitScript` (which sets `window.__CONFIG__.subscription_required`)
// applies before module-level reads in `ComfyRunButton/index.ts` evaluate.
function createSubscriptionTest(
  ...defaultOps: Parameters<typeof createSubscriptionHelper>[1][]
) {
  return comfyPageFixture.extend<{
    subscriptionHelper: SubscriptionHelper
  }>({
    initialSettings: {
      'Comfy.Extension.Disabled': ['Comfy.Cloud.Subscription']
    },
    subscriptionHelper: [
      async ({ comfyPage }, use) => {
        const helper = createSubscriptionHelper(comfyPage.page, ...defaultOps)
        await helper.mock()
        await comfyPage.page.reload()
        // Firebase auth resolves asynchronously after app boot — wait for the
        // user button (v-if="isLoggedIn") before any test body interacts with it.
        // Note: The 15s timeout accounts for video recording overhead in CI rather than expected load time.
        await expect(
          comfyPage.page.getByTestId(TestIds.user.currentUserButton)
        ).toBeVisible({ timeout: 15000 })
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
const freeTierTest = createSubscriptionTest(
  withFreeTier(),
  withFreeTierEnabled()
)
const freeTierDisabledTest = createSubscriptionTest(withFreeTier())

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
      'SubscribeToRun click opens the platform Plans page',
      async ({ comfyPage }) => {
        await expectPlatformPlansOpened(comfyPage.page, () =>
          comfyPage.page
            .getByTestId(TestIds.topbar.subscribeToRunButton)
            .click()
        )
      }
    )

    unsubscribedTest(
      'SubscribeToRun shows short label at narrow viewport',
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
      'Subscription state transition updates UI after re-fetch',
      async ({ comfyPage, subscriptionHelper }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeVisible()

        subscriptionHelper.setStatus({
          is_active: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
        await comfyPage.page.evaluate(() => {
          window.dispatchEvent(new Event('focus'))
        })

        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeHidden()
      }
    )

    unsubscribedTest(
      'App focus refreshes stale subscription state and restores Run',
      async ({ comfyPage, subscriptionHelper }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeVisible()

        subscriptionHelper.setStatus({
          is_active: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
        await comfyPage.page.evaluate(() => {
          window.dispatchEvent(new Event('focus'))
        })

        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.queueButton)
        ).toBeVisible()
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeHidden()
      }
    )

    unsubscribedTest(
      'Returning from the Plans page refreshes stale subscription state',
      async ({ comfyPage, subscriptionHelper }) => {
        const plans = await expectPlatformPlansOpened(comfyPage.page, () =>
          comfyPage.page
            .getByTestId(TestIds.topbar.subscribeToRunButton)
            .click()
        )
        subscriptionHelper.setStatus({
          is_active: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
        await plans.close()
        await comfyPage.page.evaluate(() => {
          window.dispatchEvent(new Event('focus'))
        })

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

freeTierDisabledTest.describe(
  'Subscription buttons — free tier disabled',
  { tag: '@cloud' },
  () => {
    freeTierDisabledTest(
      'SubscribeToRun visible and Topbar subscribe button hidden for free tier disabled',
      async ({ comfyPage }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeVisible()
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeButton)
        ).toBeHidden()
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.queueButton)
        ).toBeHidden()
      }
    )
  }
)
