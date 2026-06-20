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
  // Use dispatchEvent instead of click() to bypass Playwright's actionability
  // check — in the cloud environment a subscription dialog backdrop can be
  // present during initial page load and would block a standard click.
  await page.getByTestId(TestIds.user.currentUserButton).dispatchEvent('click')
  const popover = page.getByTestId(TestIds.user.currentUserPopover)
  await expect(popover).toBeVisible()
  return popover
}

async function clickPopoverSubscribe(page: Page): Promise<void> {
  const popover = await openUserPopover(page)
  // Use dispatchEvent instead of click() because the click opens the
  // subscription dialog whose backdrop appears mid-action; Playwright's
  // actionability re-check would otherwise see the mask intercepting and
  // retry until timeout. The button is already known-visible from
  // openUserPopover, so dispatching a synthetic click is safe here.
  await popover
    .getByRole('button', { name: /subscribe/i })
    .first()
    .dispatchEvent('click')
}

// Closes the auto-opened subscription-required dialog if present.
// Polls briefly because the dialog opens asynchronously after the
// `isLoggedIn` watcher fires on app boot.
async function dismissSubscriptionDialogIfOpen(page: Page): Promise<void> {
  // Target only the subscription-required dialog by its known aria-labelledby
  // key — avoids strict-mode violations when multiple GlobalDialog items are
  // on the stack simultaneously.
  const dialog = page.locator('[aria-labelledby="subscription-required"]')
  // Use expect with a short timeout: this is intentionally a "dismiss if open"
  // helper, so absence of the dialog (TimeoutError) is not a failure — we
  // discard only the timeout error, not any other unexpected exception.
  const appeared = await expect(dialog)
    .toBeVisible({ timeout: 2000 })
    .then(() => true)
    .catch((e: Error) => {
      if (e.message.includes('Timeout')) return false
      throw e
    })
  if (!appeared) return
  const closeButton = dialog.getByRole('button', { name: /close/i }).first()
  if (await closeButton.isVisible()) {
    await closeButton.click()
  } else {
    await page.keyboard.press('Escape')
  }
  await expect(dialog).toBeHidden()
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
        // Disable the cloud-subscription extension so its `requireActive
        // Subscription` watcher doesn't auto-open the subscription dialog
        // on app boot. The PrimeVue Dialog mask would otherwise intercept
        // pointer events on every topbar button these tests interact with.
        await comfyPage.setupSettings({
          'Comfy.Extension.Disabled': ['Comfy.Cloud.Subscription']
        })
        await comfyPage.page.reload()
        // Wait for Firebase auth to resolve: the user button is v-if="isLoggedIn"
        // and only renders after onAuthStateChanged fires with the mock user from
        // IndexedDB. waitForAppReady() does not wait for this — Firebase resolves
        // asynchronously after app boot. Waiting here ensures the button is
        // present before any test body tries to click it.
        await expect(
          comfyPage.page.getByTestId(TestIds.user.currentUserButton)
        ).toBeVisible()
        // Defense-in-depth: if the dialog still surfaces (e.g. via a
        // different code path), dismiss it before the test runs.
        await dismissSubscriptionDialogIfOpen(comfyPage.page)
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
        // Use the aria-labelledby key to target only the subscription dialog —
        // avoids strict-mode violations when a second GlobalDialog is stacked.
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
