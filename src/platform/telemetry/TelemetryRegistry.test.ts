import { describe, expect, it, vi } from 'vitest'

import { TelemetryRegistry } from './TelemetryRegistry'
import type { AppModePanelResizedMetadata, TelemetryProvider } from './types'

describe('TelemetryRegistry', () => {
  it('forwards trackAppModePanelResized to registered providers', () => {
    const registry = new TelemetryRegistry()
    const trackAppModePanelResized = vi.fn()
    const provider: TelemetryProvider = { trackAppModePanelResized }
    registry.registerProvider(provider)

    const metadata: AppModePanelResizedMetadata = {
      panel: 'input',
      direction: 'wider',
      previous_width_px: 320,
      new_width_px: 480,
      sidebar_location: 'left'
    }
    registry.trackAppModePanelResized(metadata)

    expect(trackAppModePanelResized).toHaveBeenCalledWith(metadata)
  })
})
