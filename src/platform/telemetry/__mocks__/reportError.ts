import { vi } from 'vitest'

import type { reportError as realReportError } from '../reportError'

export const reportError = vi.fn<typeof realReportError>()
