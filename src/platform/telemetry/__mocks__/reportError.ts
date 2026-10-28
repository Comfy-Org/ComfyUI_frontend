import { vi } from 'vitest'

import type {
  flushErrorReports as realFlushErrorReports,
  markErrorReported as realMarkErrorReported,
  reportError as realReportError
} from '@/platform/telemetry/reportError'

export const reportError = vi.fn<typeof realReportError>()
export const markErrorReported = vi.fn<typeof realMarkErrorReported>()
export const flushErrorReports = vi.fn<typeof realFlushErrorReports>()
