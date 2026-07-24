import { expect, errors } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import { PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY } from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import {
  createBalance,
  createSubscriptionStatus,
  UNSUBSCRIBED,
  ZERO_BALANCE
} from '@e2e/fixtures/data/subscriptionFixtures'
import type {
  BalanceResponse,
  SubscriptionStatusResponse
} from '@e2e/fixtures/data/subscriptionFixtures'
import { TestIds } from '@e2e/fixtures/selectors'

export interface SubscriptionConfig {
  status: SubscriptionStatusResponse
  balance: BalanceResponse
}

function emptyConfig(): SubscriptionConfig {
  return {
    status: createSubscriptionStatus(UNSUBSCRIBED),
    balance: createBalance(ZERO_BALANCE)
  }
}

export type SubscriptionOperator = (
  config: SubscriptionConfig
) => SubscriptionConfig

function withSubscriptionStatus(
  overrides: Partial<SubscriptionStatusResponse>
): SubscriptionOperator {
  return (config) => ({
    ...config,
    status: { ...config.status, ...overrides }
  })
}

export function withActiveSubscription(
  tier: NonNullable<SubscriptionStatusResponse['subscription_tier']> = 'CREATOR'
): SubscriptionOperator {
  return withSubscriptionStatus({
    is_active: true,
    subscription_tier: tier,
    renewal_date: '2099-12-31T00:00:00.000Z',
    end_date: null
  })
}

export function withFreeTier(): SubscriptionOperator {
  return withSubscriptionStatus({
    is_active: true,
    subscription_tier: 'FREE',
    end_date: null
  })
}

export function withUnsubscribed(): SubscriptionOperator {
  return withSubscriptionStatus({
    is_active: false,
    subscription_tier: 'FREE',
    end_date: null,
    renewal_date: null
  })
}

export class SubscriptionHelper {
  private statusResponse: SubscriptionStatusResponse
  private balanceResponse: BalanceResponse
  private routeHandlers: Array<{
    pattern: string
    handler: (route: Route) => Promise<void>
  }> = []

  constructor(
    private readonly page: Page,
    config: SubscriptionConfig = emptyConfig()
  ) {
    this.statusResponse = { ...config.status }
    this.balanceResponse = { ...config.balance }
  }

  async mock(): Promise<void> {
    await this.page.addInitScript(() => {
      window.__CONFIG__ = {
        ...window.__CONFIG__,
        subscription_required: true
      }
    })

    // The cloud build calls `/api/features` at boot via `refreshRemoteConfig`,
    // which overwrites `window.__CONFIG__` wholesale. Mock it to preserve
    // `subscription_required: true` after that fetch resolves.
    const featuresPattern = '**/api/features'
    const featuresHandler = async (route: Route) => {
      await route.fulfill({ json: { subscription_required: true } })
    }
    this.routeHandlers.push({ pattern: featuresPattern, handler: featuresHandler })
    await this.page.route(featuresPattern, featuresHandler)

    const statusPattern = '**/customers/cloud-subscription-status'
    const statusHandler = async (route: Route) => {
      await route.fulfill({ json: this.statusResponse })
    }
    this.routeHandlers.push({ pattern: statusPattern, handler: statusHandler })
    await this.page.route(statusPattern, statusHandler)

    const balancePattern = '**/customers/balance'
    const balanceHandler = async (route: Route) => {
      await route.fulfill({ json: this.balanceResponse })
    }
    this.routeHandlers.push({ pattern: balancePattern, handler: balanceHandler })
    await this.page.route(balancePattern, balanceHandler)

    const checkoutPattern = '**/customers/cloud-subscription-checkout**'
    const checkoutHandler = async (route: Route) => {
      await route.fulfill({
        json: { checkout_url: 'https://checkout.stripe.com/mock' }
      })
    }
    this.routeHandlers.push({ pattern: checkoutPattern, handler: checkoutHandler })
    await this.page.route(checkoutPattern, checkoutHandler)
  }

  configure(...operators: SubscriptionOperator[]): void {
    const config = operators.reduce<SubscriptionConfig>(
      (cfg, op) => op(cfg),
      {
        status: { ...this.statusResponse },
        balance: { ...this.balanceResponse }
      }
    )
    this.statusResponse = { ...config.status }
    this.balanceResponse = { ...config.balance }
  }

  setStatus(overrides: Partial<SubscriptionStatusResponse>): void {
    this.statusResponse = { ...this.statusResponse, ...overrides }
  }

  setBalance(overrides: Partial<BalanceResponse>): void {
    this.balanceResponse = { ...this.balanceResponse, ...overrides }
  }

  /**
   * Seed localStorage with a pending checkout attempt so that
   * `recoverPendingSubscriptionCheckout` triggers a status re-fetch on
   * the next `visibilitychange` event. Must be called after navigation.
   */
  async seedPendingCheckout(
    tier: string = 'standard',
    cycle: string = 'monthly'
  ): Promise<void> {
    const storageKey = PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
    await this.page.evaluate(
      ([key, t, c]) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            attempt_id: `test-${Date.now()}`,
            started_at_ms: Date.now(),
            tier: t,
            cycle: c,
            checkout_type: 'new'
          })
        )
      },
      [storageKey, tier, cycle] as const
    )
  }

  /**
   * Dispatch `visibilitychange` to simulate returning from Stripe checkout.
   * The app re-fetches subscription status when a pending checkout attempt
   * exists in localStorage (seeded via `seedPendingCheckout`).
   */
  async triggerSubscriptionRefetch(): Promise<void> {
    await this.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  /**
   * Open the user popover and return its locator after verifying visibility.
   * Uses `dispatchEvent` to bypass Playwright's actionability check — a
   * subscription dialog backdrop can intercept a normal `.click()` during
   * initial page load.
   */
  async openUserPopover() {
    await this.page.getByTestId(TestIds.user.currentUserButton).dispatchEvent('click')
    const popover = this.page.getByTestId(TestIds.user.currentUserPopover)
    await expect(popover).toBeVisible()
    return popover
  }

  /**
   * Open the user popover and click the subscribe button.
   * Uses `dispatchEvent` on the button too — the subscription dialog's
   * backdrop appears mid-action, which would cause Playwright's actionability
   * re-check to block a standard `.click()`.
   */
  async clickPopoverSubscribe(): Promise<void> {
    const popover = await this.openUserPopover()
    await popover
      .getByRole('button', { name: /subscribe/i })
      .first()
      .dispatchEvent('click')
  }

  /**
   * Dismiss the subscription-required dialog if it appears after boot.
   * The dialog opens asynchronously after the `isLoggedIn` watcher fires,
   * so we poll briefly; absence is not a failure.
   */
  async dismissSubscriptionDialogIfOpen(): Promise<void> {
    const dialog = this.page.locator('[aria-labelledby="subscription-required"]')
    const appeared = await expect(dialog)
      .toBeVisible({ timeout: 2000 })
      .then(() => true)
      .catch((e: unknown) => {
        if (e instanceof errors.TimeoutError) return false
        throw e
      })
    if (!appeared) return
    const closeButton = dialog.getByRole('button', { name: /close/i }).first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
    } else {
      await this.page.keyboard.press('Escape')
    }
    await expect(dialog).toBeHidden()
  }

  async clearMocks(): Promise<void> {
    for (const { pattern, handler } of this.routeHandlers) {
      await this.page.unroute(pattern, handler)
    }
    this.routeHandlers = []
    this.statusResponse = { ...UNSUBSCRIBED }
    this.balanceResponse = { ...ZERO_BALANCE }
  }
}

export function createSubscriptionHelper(
  page: Page,
  ...operators: SubscriptionOperator[]
): SubscriptionHelper {
  const config = operators.reduce<SubscriptionConfig>(
    (cfg, op) => op(cfg),
    emptyConfig()
  )
  return new SubscriptionHelper(page, config)
}
