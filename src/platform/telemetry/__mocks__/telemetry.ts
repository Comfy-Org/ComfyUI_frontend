import { vi } from 'vitest'

import { TelemetryRegistry } from '../TelemetryRegistry'
import type { TelemetryDispatcher, TelemetryProvider } from '../types'

export function createTelemetryMock(
  overrides: TelemetryProvider = {}
): TelemetryDispatcher {
  return Object.assign(vi.mockObject(new TelemetryRegistry()), overrides)
}
