import { describe, expect, it, vi } from 'vitest'

import { TelemetryRegistry } from './TelemetryRegistry'
import type { TelemetryProvider } from './types'

describe('TelemetryRegistry', () => {
  it('dispatches trackSearchQuery to every registered provider', () => {
    const a: TelemetryProvider = { trackSearchQuery: vi.fn() }
    const b: TelemetryProvider = { trackSearchQuery: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    registry.trackSearchQuery({
      surface: 'templates',
      query: 'flux',
      query_length: 4,
      result_count: 3,
      has_results: true
    })

    const payload = {
      surface: 'templates',
      query: 'flux',
      query_length: 4,
      result_count: 3,
      has_results: true
    }
    expect(a.trackSearchQuery).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackSearchQuery).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('dispatches trackBeginCheckout with intent metadata to every provider', () => {
    const a: TelemetryProvider = { trackBeginCheckout: vi.fn() }
    const b: TelemetryProvider = {}
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const metadata = {
      user_id: 'user-1',
      tier: 'pro' as const,
      cycle: 'monthly' as const,
      checkout_type: 'new' as const,
      payment_intent_source: 'subscribe_to_run' as const
    }
    registry.trackBeginCheckout(metadata)

    expect(a.trackBeginCheckout).toHaveBeenCalledExactlyOnceWith(metadata)
  })

  it('dispatches trackAuthFailed to every registered provider', () => {
    const a: TelemetryProvider = { trackAuthFailed: vi.fn() }
    const b: TelemetryProvider = { trackAuthFailed: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      error_code: 'auth/user-not-found',
      auth_action: 'email_sign_in' as const
    }
    registry.trackAuthFailed(payload)

    expect(a.trackAuthFailed).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackAuthFailed).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('dispatches trackAddApiCreditButtonClicked with its source', () => {
    const provider: TelemetryProvider = {
      trackAddApiCreditButtonClicked: vi.fn()
    }
    const registry = new TelemetryRegistry()
    registry.registerProvider(provider)

    registry.trackAddApiCreditButtonClicked({ source: 'credits_panel' })

    expect(
      provider.trackAddApiCreditButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({ source: 'credits_panel' })
  })

  it('skips providers that do not implement trackSearchQuery', () => {
    const empty: TelemetryProvider = {}
    const registry = new TelemetryRegistry()
    registry.registerProvider(empty)

    expect(() =>
      registry.trackSearchQuery({
        surface: 'settings',
        query: 'theme',
        query_length: 5,
        result_count: 0,
        has_results: false
      })
    ).not.toThrow()
  })

  it('dispatches subscription cancellation telemetry to every registered provider', () => {
    const a: TelemetryProvider = { trackSubscriptionCancellation: vi.fn() }
    const b: TelemetryProvider = { trackSubscriptionCancellation: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      source: 'cancel_plan_menu' as const,
      current_tier: 'standard',
      cycle: 'monthly' as const,
      end_date: '2026-08-01T00:00:00.000Z'
    }
    registry.trackSubscriptionCancellation('flow_opened', payload)

    expect(a.trackSubscriptionCancellation).toHaveBeenCalledExactlyOnceWith(
      'flow_opened',
      payload
    )
    expect(b.trackSubscriptionCancellation).toHaveBeenCalledExactlyOnceWith(
      'flow_opened',
      payload
    )
  })

  it('dispatches resubscribe click telemetry to every registered provider', () => {
    const a: TelemetryProvider = { trackResubscribeClicked: vi.fn() }
    const b: TelemetryProvider = { trackResubscribeClicked: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = { source: 'settings_billing_panel' as const }
    registry.trackResubscribeClicked(payload)

    expect(a.trackResubscribeClicked).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackResubscribeClicked).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('dispatches resubscribe succeeded/failed outcomes to every registered provider', () => {
    const a: TelemetryProvider = {
      trackResubscribeSucceeded: vi.fn(),
      trackResubscribeFailed: vi.fn()
    }
    const b: TelemetryProvider = {
      trackResubscribeSucceeded: vi.fn(),
      trackResubscribeFailed: vi.fn()
    }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const succeeded = { source: 'settings_billing_panel' as const }
    const failed = {
      source: 'settings_billing_panel' as const,
      error_message: 'card declined'
    }
    registry.trackResubscribeSucceeded(succeeded)
    registry.trackResubscribeFailed(failed)

    expect(a.trackResubscribeSucceeded).toHaveBeenCalledExactlyOnceWith(
      succeeded
    )
    expect(b.trackResubscribeSucceeded).toHaveBeenCalledExactlyOnceWith(
      succeeded
    )
    expect(a.trackResubscribeFailed).toHaveBeenCalledExactlyOnceWith(failed)
    expect(b.trackResubscribeFailed).toHaveBeenCalledExactlyOnceWith(failed)
  })

  it('dispatches trackApiCreditTopupFailed to every registered provider', () => {
    const a: TelemetryProvider = { trackApiCreditTopupFailed: vi.fn() }
    const b: TelemetryProvider = { trackApiCreditTopupFailed: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = { error_message: 'card declined' }
    registry.trackApiCreditTopupFailed(payload)

    expect(a.trackApiCreditTopupFailed).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackApiCreditTopupFailed).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('dispatches trackWorkspaceInviteFailed to every registered provider', () => {
    const a: TelemetryProvider = { trackWorkspaceInviteFailed: vi.fn() }
    const b: TelemetryProvider = { trackWorkspaceInviteFailed: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      source: 'settings_members' as const,
      attempted_count: 3,
      failed_count: 1
    }
    registry.trackWorkspaceInviteFailed(payload)

    expect(a.trackWorkspaceInviteFailed).toHaveBeenCalledExactlyOnceWith(
      payload
    )
    expect(b.trackWorkspaceInviteFailed).toHaveBeenCalledExactlyOnceWith(
      payload
    )
  })

  it('dispatches billing-operation failure and timeout telemetry to every registered provider', () => {
    const a: TelemetryProvider = {
      trackBillingOperationFailed: vi.fn(),
      trackBillingOperationTimeout: vi.fn()
    }
    const b: TelemetryProvider = {
      trackBillingOperationFailed: vi.fn(),
      trackBillingOperationTimeout: vi.fn()
    }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const failed = {
      billing_op_id: 'op-1',
      operation_type: 'subscription' as const,
      failure_reason: 'declined'
    }
    const timedOut = {
      billing_op_id: 'op-2',
      operation_type: 'topup' as const
    }
    registry.trackBillingOperationFailed(failed)
    registry.trackBillingOperationTimeout(timedOut)

    expect(a.trackBillingOperationFailed).toHaveBeenCalledExactlyOnceWith(
      failed
    )
    expect(b.trackBillingOperationFailed).toHaveBeenCalledExactlyOnceWith(
      failed
    )
    expect(a.trackBillingOperationTimeout).toHaveBeenCalledExactlyOnceWith(
      timedOut
    )
    expect(b.trackBillingOperationTimeout).toHaveBeenCalledExactlyOnceWith(
      timedOut
    )
  })

  it('dispatches the downgrade-to-personal lifecycle events to every registered provider', () => {
    const a: TelemetryProvider = {
      trackDowngradeToPersonalStarted: vi.fn(),
      trackDowngradeToPersonalSucceeded: vi.fn(),
      trackDowngradeToPersonalFailed: vi.fn()
    }
    const b: TelemetryProvider = {
      trackDowngradeToPersonalStarted: vi.fn(),
      trackDowngradeToPersonalSucceeded: vi.fn(),
      trackDowngradeToPersonalFailed: vi.fn()
    }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const started = { member_removal_count: 2 }
    const succeeded = {
      member_removal_count: 2,
      member_removal_failures: 0,
      target_tier: 'standard' as const
    }
    const failed = {
      member_removal_count: 2,
      member_removal_failures: 1,
      failure_reason: 'network error'
    }
    registry.trackDowngradeToPersonalStarted(started)
    registry.trackDowngradeToPersonalSucceeded(succeeded)
    registry.trackDowngradeToPersonalFailed(failed)

    expect(a.trackDowngradeToPersonalStarted).toHaveBeenCalledExactlyOnceWith(
      started
    )
    expect(b.trackDowngradeToPersonalStarted).toHaveBeenCalledExactlyOnceWith(
      started
    )
    expect(a.trackDowngradeToPersonalSucceeded).toHaveBeenCalledExactlyOnceWith(
      succeeded
    )
    expect(b.trackDowngradeToPersonalSucceeded).toHaveBeenCalledExactlyOnceWith(
      succeeded
    )
    expect(a.trackDowngradeToPersonalFailed).toHaveBeenCalledExactlyOnceWith(
      failed
    )
    expect(b.trackDowngradeToPersonalFailed).toHaveBeenCalledExactlyOnceWith(
      failed
    )
  })

  it('dispatches trackSubscriptionCheckoutFailed to every registered provider', () => {
    const a: TelemetryProvider = { trackSubscriptionCheckoutFailed: vi.fn() }
    const b: TelemetryProvider = { trackSubscriptionCheckoutFailed: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      tier: 'pro' as const,
      cycle: 'monthly' as const,
      checkout_type: 'new' as const,
      error_message: 'card declined'
    }
    registry.trackSubscriptionCheckoutFailed(payload)

    expect(a.trackSubscriptionCheckoutFailed).toHaveBeenCalledExactlyOnceWith(
      payload
    )
    expect(b.trackSubscriptionCheckoutFailed).toHaveBeenCalledExactlyOnceWith(
      payload
    )
  })
})
