import type { Page, Route } from '@playwright/test'

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

export function withSubscriptionStatus(
  overrides: Partial<SubscriptionStatusResponse>
): SubscriptionOperator {
  return (config) => ({
    ...config,
    status: { ...config.status, ...overrides }
  })
}

export function withBalance(
  overrides: Partial<BalanceResponse>
): SubscriptionOperator {
  return (config) => ({
    ...config,
    balance: { ...config.balance, ...overrides }
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

export function withCancelledSubscription(): SubscriptionOperator {
  return withSubscriptionStatus({
    is_active: true,
    subscription_tier: 'CREATOR',
    end_date: '2099-12-31T00:00:00.000Z'
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

export function withCredits(amountMicros: number): SubscriptionOperator {
  return withBalance({
    amount_micros: amountMicros,
    effective_balance_micros: amountMicros
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
    this.statusResponse = createSubscriptionStatus(config.status)
    this.balanceResponse = createBalance(config.balance)
  }

  async mock(): Promise<void> {
    await this.page.addInitScript(() => {
      window.__CONFIG__ = {
        ...window.__CONFIG__,
        subscription_required: true
      }
    })

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
    this.routeHandlers.push({
      pattern: balancePattern,
      handler: balanceHandler
    })
    await this.page.route(balancePattern, balanceHandler)

    const checkoutPattern = '**/customers/cloud-subscription-checkout**'
    const checkoutHandler = async (route: Route) => {
      await route.fulfill({
        json: { checkout_url: 'https://checkout.stripe.com/mock' }
      })
    }
    this.routeHandlers.push({
      pattern: checkoutPattern,
      handler: checkoutHandler
    })
    await this.page.route(checkoutPattern, checkoutHandler)
  }

  configure(...operators: SubscriptionOperator[]): void {
    const base: SubscriptionConfig = {
      status: createSubscriptionStatus(this.statusResponse),
      balance: createBalance(this.balanceResponse)
    }
    const config = operators.reduce<SubscriptionConfig>(
      (cfg, op) => op(cfg),
      base
    )
    this.statusResponse = createSubscriptionStatus(config.status)
    this.balanceResponse = createBalance(config.balance)
  }

  setStatus(overrides: Partial<SubscriptionStatusResponse>): void {
    this.statusResponse = {
      ...this.statusResponse,
      ...overrides
    }
  }

  setBalance(overrides: Partial<BalanceResponse>): void {
    this.balanceResponse = {
      ...this.balanceResponse,
      ...overrides
    }
  }

  /**
   * Seed localStorage with a pending checkout attempt.
   * Required for `visibilitychange` to trigger a subscription re-fetch,
   * because `recoverPendingSubscriptionCheckout` checks
   * `hasPendingSubscriptionCheckoutAttempt()` before fetching.
   *
   * Call AFTER page navigation (localStorage needs a page context).
   */
  async seedPendingCheckout(
    tier: string = 'standard',
    cycle: string = 'monthly'
  ): Promise<void> {
    await this.page.evaluate(
      ([t, c]) => {
        localStorage.setItem(
          'comfy.subscription.pending_checkout_attempt',
          JSON.stringify({
            attempt_id: `test-${Date.now()}`,
            started_at_ms: Date.now(),
            tier: t,
            cycle: c,
            checkout_type: 'new'
          })
        )
      },
      [tier, cycle] as const
    )
  }

  /**
   * Dispatch `visibilitychange` to trigger pending-checkout recovery.
   * The app listens for this event and re-fetches subscription status
   * when a pending checkout attempt exists in localStorage.
   */
  async triggerSubscriptionRefetch(): Promise<void> {
    await this.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  async clearMocks(): Promise<void> {
    for (const { pattern, handler } of this.routeHandlers) {
      await this.page.unroute(pattern, handler)
    }
    this.routeHandlers = []
    this.statusResponse = createSubscriptionStatus(UNSUBSCRIBED)
    this.balanceResponse = createBalance(ZERO_BALANCE)
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
