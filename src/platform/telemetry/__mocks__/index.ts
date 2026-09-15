import { vi } from 'vitest'

import type {
  setTelemetryRegistry as realSetTelemetryRegistry,
  useTelemetry as realUseTelemetry
} from '../index'
import { TelemetryRegistry } from '../TelemetryRegistry'

const telemetryMock = vi.mockObject(new TelemetryRegistry())
export const useTelemetry = vi.fn<typeof realUseTelemetry>(() => telemetryMock)
export const setTelemetryRegistry = vi.fn<typeof realSetTelemetryRegistry>()
