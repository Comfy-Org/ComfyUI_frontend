import { vi } from 'vitest'

import type { fetchHistoryPage as RealFetchHistoryPage } from '../fetchJobs'

export const fetchHistoryPage = vi.fn<typeof RealFetchHistoryPage>()
