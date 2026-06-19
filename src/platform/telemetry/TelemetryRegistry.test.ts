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

  it('forwards each cloud funnel event to registered providers', () => {
    const provider: TelemetryProvider = {
      trackAuthMethodSelected: vi.fn(),
      trackOAuthPopupResult: vi.fn(),
      trackAuthFailed: vi.fn(),
      trackAuthError: vi.fn(),
      trackCanvasReady: vi.fn(),
      trackOnboardingRouted: vi.fn(),
      trackPaywallViewed: vi.fn(),
      trackCheckoutViewed: vi.fn(),
      trackCheckoutReturned: vi.fn(),
      trackCheckoutInitiateFailed: vi.fn(),
      trackCheckoutWindowBlocked: vi.fn(),
      trackBillingCycleToggled: vi.fn(),
      trackTemplateCategorySelected: vi.fn(),
      trackFirstExecutionCompleted: vi.fn(),
      trackOutputViewed: vi.fn()
    }
    const registry = new TelemetryRegistry()
    registry.registerProvider(provider)

    registry.trackAuthMethodSelected({ method: 'email', view: 'login' })
    registry.trackOAuthPopupResult({ provider: 'google', result: 'success' })
    registry.trackAuthFailed({ method: 'email', stage: 'firebase' })
    registry.trackAuthError({ method: 'email', is_sign_up: true })
    registry.trackCanvasReady({ is_new_user: true })
    registry.trackOnboardingRouted({
      destination: 'survey',
      survey_completed: true,
      has_cloud_status: false
    })
    registry.trackPaywallViewed({ reason: 'run_button' })
    registry.trackCheckoutViewed({
      checkout_attempt_id: 'att_1',
      tier: 'pro',
      cycle: 'monthly'
    })
    registry.trackCheckoutReturned({
      checkout_attempt_id: 'att_1',
      outcome: 'success'
    })
    registry.trackCheckoutInitiateFailed({ stage: 'no_url' })
    registry.trackCheckoutWindowBlocked({})
    registry.trackBillingCycleToggled({ from: 'monthly', to: 'yearly' })
    registry.trackTemplateCategorySelected({ category_id: 'image' })
    registry.trackFirstExecutionCompleted({ workflow_run_id: 'run_1' })
    registry.trackOutputViewed({
      workflow_run_id: 'run_1',
      media_type: 'image',
      is_first_output: true
    })

    expect(provider.trackAuthMethodSelected).toHaveBeenCalledExactlyOnceWith({
      method: 'email',
      view: 'login'
    })
    expect(provider.trackOAuthPopupResult).toHaveBeenCalledExactlyOnceWith({
      provider: 'google',
      result: 'success'
    })
    expect(provider.trackAuthFailed).toHaveBeenCalledExactlyOnceWith({
      method: 'email',
      stage: 'firebase'
    })
    expect(provider.trackAuthError).toHaveBeenCalledExactlyOnceWith({
      method: 'email',
      is_sign_up: true
    })
    expect(provider.trackCanvasReady).toHaveBeenCalledExactlyOnceWith({
      is_new_user: true
    })
    expect(provider.trackOnboardingRouted).toHaveBeenCalledExactlyOnceWith({
      destination: 'survey',
      survey_completed: true,
      has_cloud_status: false
    })
    expect(provider.trackPaywallViewed).toHaveBeenCalledExactlyOnceWith({
      reason: 'run_button'
    })
    expect(provider.trackCheckoutViewed).toHaveBeenCalledExactlyOnceWith({
      checkout_attempt_id: 'att_1',
      tier: 'pro',
      cycle: 'monthly'
    })
    expect(provider.trackCheckoutReturned).toHaveBeenCalledExactlyOnceWith({
      checkout_attempt_id: 'att_1',
      outcome: 'success'
    })
    expect(
      provider.trackCheckoutInitiateFailed
    ).toHaveBeenCalledExactlyOnceWith({ stage: 'no_url' })
    expect(provider.trackCheckoutWindowBlocked).toHaveBeenCalledExactlyOnceWith(
      {}
    )
    expect(provider.trackBillingCycleToggled).toHaveBeenCalledExactlyOnceWith({
      from: 'monthly',
      to: 'yearly'
    })
    expect(
      provider.trackTemplateCategorySelected
    ).toHaveBeenCalledExactlyOnceWith({ category_id: 'image' })
    expect(
      provider.trackFirstExecutionCompleted
    ).toHaveBeenCalledExactlyOnceWith({ workflow_run_id: 'run_1' })
    expect(provider.trackOutputViewed).toHaveBeenCalledExactlyOnceWith({
      workflow_run_id: 'run_1',
      media_type: 'image',
      is_first_output: true
    })
  })
})
