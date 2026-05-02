import { expect } from '@playwright/test'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  createSubscriptionHelper,
  withActiveSubscription,
  withFreeTier,
  withUnsubscribed
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import type { Locator, Page } from '@playwright/test'
import type { SubscriptionHelper } from '@e2e/fixtures/helpers/SubscriptionHelper'

async function openUserPopover(page: Page): Promise<Locator> {
  await page.getByTestId(TestIds.user.currentUserButton).click()
  const popover = page.getByTestId(TestIds.user.currentUserPopover)
  await expect(popover).toBeVisible()
  return popover
}

async function clickPopoverSubscribe(page: Page): Promise<void> {
  const popover = await openUserPopover(page)
  await popover
    .getByRole('button', { name: /subscribe/i })
    .first()
    .click()
}

// Installs subscription mocks AFTER comfyPage.setup() and reloads the page
// so `addInitScript` (which sets `window.__CONFIG__.subscription_required`)
// applies before module-level reads in `ComfyRunButton/index.ts` evaluate.
// Depending on `comfyPage` here forces ordering: comfyPage's auth + setup
// runs first, then mocks are installed, then the page reloads with the
// mocked config + intercepted endpoints in place.
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
        // Disable the cloud-subscription extension so it doesn't auto-open
        // the subscription-required modal on app load (which would block
        // clicks on the topbar buttons we're testing).
        await comfyPage.setupSettings({
          'Comfy.Extension.Disabled': ['Comfy.Cloud.Subscription']
        })
        await comfyPage.page.reload()
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
        await expect(comfyPage.page.getByRole('dialog')).toBeVisible()
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
      'User popover shows subscribe when unsubscribed',
      async ({ comfyPage }) => {
        const popover = await openUserPopover(comfyPage.page)
        await expect(
          popover.getByRole('button', { name: /subscribe/i })
        ).toBeVisible()
      }
    )

    unsubscribedTest(
      'User popover subscribe click opens dialog',
      async ({ comfyPage }) => {
        await clickPopoverSubscribe(comfyPage.page)
        await expect(comfyPage.page.getByRole('dialog')).toBeVisible()
      }
    )

    unsubscribedTest(
      'Subscription state transition updates UI after re-fetch',
      async ({ comfyPage, subscriptionHelper }) => {
        await expect(
          comfyPage.page.getByTestId(TestIds.topbar.subscribeToRunButton)
        ).toBeVisible()

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
        ).toBeHidden()
      }
    )

    unsubscribedTest(
      'Cleanup prevents stale subscription state after dialog close',
      async ({ comfyPage, subscriptionHelper }) => {
        await clickPopoverSubscribe(comfyPage.page)
        const dialog = comfyPage.page.getByRole('dialog')
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
        ).toBeVisible()
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
        ).toBeVisible()
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
