import { vi } from 'vitest'

import type {
  configureErrorReporter as realConfigureErrorReporter,
  flushErrorReports as realFlushErrorReports,
  markErrorReported as realMarkErrorReported,
  reportError as realReportError
} from '@comfyorg/telemetry/reportError'

export const reportError = vi.fn<typeof realReportError>()
export const markErrorReported = vi.fn<typeof realMarkErrorReported>()
export const flushErrorReports = vi.fn<typeof realFlushErrorReports>()
export const configureErrorReporter = vi.fn<typeof realConfigureErrorReporter>()
