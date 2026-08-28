import { vi } from 'vitest'

import type { reportError as ReportError } from '../reportError'

export const reportError = vi.fn<typeof ReportError>()
