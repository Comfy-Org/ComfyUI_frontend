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
})
