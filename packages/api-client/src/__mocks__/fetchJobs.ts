import { vi } from 'vitest'

import type { fetchHistoryPage as RealFetchHistoryPage } from '@comfyorg/api-client/fetchJobs'

export const fetchHistoryPage = vi.fn<typeof RealFetchHistoryPage>()
