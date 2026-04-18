import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  createSubscriptionHelper,
  withActiveSubscription,
  withFreeTier,
  withSubscriptionStatus,
  withUnsubscribed
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { SubscriptionOperator } from '@e2e/fixtures/helpers/SubscriptionHelper'

async function setupSubscriptionMocks(
  comfyPage: ComfyPage,
  ...operators: SubscriptionOperator[]
) {
  const helper = createSubscriptionHelper(comfyPage.page, ...operators)
  await helper.mock()
  await comfyPage.setup({ clearStorage: false })
  return helper
}

async function openUserPopover(
  page: Parameters<typeof createSubscriptionHelper>[0]
) {
  const currentUserIndicator = page
    .getByTestId(TestIds.user.currentUserIndicator)
    .or(page.getByRole('button', { name: /current user/i }))
  await currentUserIndicator.click()
}

test.describe('Subscription buttons', { tag: '@cloud' }, () => {
  test('SubscribeToRun visible when unsubscribed', async ({ comfyPage }) => {
    const helper = await setupSubscriptionMocks(comfyPage, withUnsubscribed())

    await expect
      .poll(
        () => comfyPage.page.getByTestId('subscribe-to-run-button').isVisible(),
        { timeout: 10_000 }
      )
      .toBe(true)

    await helper.clearMocks()
  })

  test('SubscribeToRun hidden when subscribed', async ({ comfyPage }) => {
    const helper = await setupSubscriptionMocks(
      comfyPage,
      withActiveSubscription('CREATOR')
    )

    await expect
      .poll(
        () => comfyPage.page.getByTestId('subscribe-to-run-button').count(),
        { timeout: 10_000 }
      )
      .toBe(0)

    await helper.clearMocks()
  })

  test('SubscribeToRun click opens subscription dialog', async ({
    comfyPage
  }) => {
    const helper = await setupSubscriptionMocks(comfyPage, withUnsubscribed())

    await comfyPage.page.getByTestId('subscribe-to-run-button').click()

    await expect
      .poll(() => comfyPage.page.getByRole('dialog').count(), {
        timeout: 10_000
      })
      .toBe(1)

    await helper.clearMocks()
  })

  test(
    'SubscribeToRun shows short label on mobile',
    { tag: '@mobile' },
    async ({ comfyPage }) => {
      const helper = await setupSubscriptionMocks(comfyPage, withUnsubscribed())
      const subscribeToRunButton = comfyPage.page.getByTestId(
        'subscribe-to-run-button'
      )

      await expect(subscribeToRunButton).toBeVisible()
      await expect(subscribeToRunButton).not.toContainText(/to run/i)

      await helper.clearMocks()
    }
  )

  test('User popover shows subscribe when unsubscribed', async ({
    comfyPage
  }) => {
    const helper = await setupSubscriptionMocks(comfyPage, withUnsubscribed())

    await openUserPopover(comfyPage.page)

    await expect
      .poll(
        () =>
          comfyPage.page.getByRole('button', { name: /subscribe/i }).count(),
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)

    await helper.clearMocks()
  })

  test('User popover subscribe click opens dialog', async ({ comfyPage }) => {
    const helper = await setupSubscriptionMocks(comfyPage, withUnsubscribed())

    await openUserPopover(comfyPage.page)
    await comfyPage.page
      .getByRole('button', { name: /subscribe/i })
      .first()
      .click()

    await expect
      .poll(() => comfyPage.page.getByRole('dialog').count(), {
        timeout: 10_000
      })
      .toBe(1)

    await helper.clearMocks()
  })

  test('Topbar subscribe button visible for free tier', async ({
    comfyPage
  }) => {
    const helper = await setupSubscriptionMocks(comfyPage, withFreeTier())

    await expect
      .poll(
        () =>
          comfyPage.page
            .getByTestId(TestIds.topbar.subscribeButton)
            .isVisible(),
        { timeout: 10_000 }
      )
      .toBe(true)

    await helper.clearMocks()
  })

  test('Topbar subscribe button hidden for paid tier', async ({
    comfyPage
  }) => {
    const helper = await setupSubscriptionMocks(
      comfyPage,
      withActiveSubscription('PRO')
    )

    await expect
      .poll(
        () =>
          comfyPage.page.getByTestId(TestIds.topbar.subscribeButton).count(),
        { timeout: 10_000 }
      )
      .toBe(0)

    await helper.clearMocks()
  })

  test('Subscription state transition closes dialog', async ({ comfyPage }) => {
    const helper = await setupSubscriptionMocks(
      comfyPage,
      withSubscriptionStatus({
        is_active: false,
        subscription_tier: 'CREATOR',
        end_date: null
      })
    )

    await openUserPopover(comfyPage.page)
    await comfyPage.page
      .getByRole('button', { name: /subscribe/i })
      .first()
      .click()

    await expect
      .poll(() => comfyPage.page.getByRole('dialog').count(), {
        timeout: 10_000
      })
      .toBe(1)

    helper.setStatus({ is_active: true })
    await comfyPage.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await expect
      .poll(() => comfyPage.page.getByRole('dialog').count(), {
        timeout: 10_000
      })
      .toBe(0)

    await helper.clearMocks()
  })

  test('Cleanup prevents false subscribed after unmount', async ({
    comfyPage
  }) => {
    const helper = await setupSubscriptionMocks(
      comfyPage,
      withSubscriptionStatus({
        is_active: false,
        subscription_tier: 'CREATOR',
        end_date: null
      })
    )

    await openUserPopover(comfyPage.page)
    await comfyPage.page
      .getByRole('button', { name: /subscribe/i })
      .first()
      .click()

    await expect
      .poll(() => comfyPage.page.getByRole('dialog').count(), {
        timeout: 10_000
      })
      .toBe(1)

    await comfyPage.page.getByRole('button', { name: /close/i }).first().click()
    await expect
      .poll(() => comfyPage.page.getByRole('dialog').count(), {
        timeout: 10_000
      })
      .toBe(0)

    helper.setStatus({ is_active: true })
    await comfyPage.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await expect
      .poll(() => comfyPage.page.getByRole('dialog').count(), {
        timeout: 10_000
      })
      .toBe(0)

    await helper.clearMocks()
  })
})
