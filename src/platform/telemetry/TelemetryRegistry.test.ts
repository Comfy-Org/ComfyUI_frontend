import { describe, expect, it, vi } from 'vitest'

import { TelemetryRegistry } from './TelemetryRegistry'
import type { TelemetryProvider } from './types'

describe('TelemetryRegistry', () => {
  it('dispatches trackSearchKeystroke to every registered provider', () => {
    const a: TelemetryProvider = { trackSearchKeystroke: vi.fn() }
    const b: TelemetryProvider = { trackSearchKeystroke: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    registry.trackSearchKeystroke({
      surface: 'template_search',
      query: 'flux',
      query_length: 4
    })

    const payload = {
      surface: 'template_search',
      query: 'flux',
      query_length: 4
    }
    expect(a.trackSearchKeystroke).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackSearchKeystroke).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('skips providers that do not implement trackSearchKeystroke', () => {
    const empty: TelemetryProvider = {}
    const registry = new TelemetryRegistry()
    registry.registerProvider(empty)

    expect(() =>
      registry.trackSearchKeystroke({
        surface: 'settings_search',
        query: 'theme',
        query_length: 5
      })
    ).not.toThrow()
  })
})
