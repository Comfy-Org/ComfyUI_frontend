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

  it('getDistinctId returns the first provider id, skipping those without one', () => {
    const registry = new TelemetryRegistry()
    registry.registerProvider({})
    registry.registerProvider({ getDistinctId: () => 'ph-1' })
    registry.registerProvider({ getDistinctId: () => 'ph-2' })

    expect(registry.getDistinctId()).toBe('ph-1')
  })

  it('getDistinctId returns null when no provider has one', () => {
    const registry = new TelemetryRegistry()
    registry.registerProvider({})
    registry.registerProvider({ getDistinctId: () => null })

    expect(registry.getDistinctId()).toBeNull()
  })

  it('getDistinctId skips a provider that throws and returns the next id', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const registry = new TelemetryRegistry()
    registry.registerProvider({
      getDistinctId: () => {
        throw new Error('boom')
      }
    })
    registry.registerProvider({ getDistinctId: () => 'ph-2' })

    expect(registry.getDistinctId()).toBe('ph-2')
  })
})
