import { vi } from 'vitest'

import type {
  setTelemetryRegistry as realSetTelemetryRegistry,
  useTelemetry as realUseTelemetry
} from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'

const telemetryMock = vi.mockObject(new TelemetryRegistry())
export const useTelemetry = vi.fn<typeof realUseTelemetry>(() => telemetryMock)
export const setTelemetryRegistry = vi.fn<typeof realSetTelemetryRegistry>()
