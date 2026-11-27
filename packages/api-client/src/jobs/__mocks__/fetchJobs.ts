import { vi } from 'vitest'

import type { fetchHistoryPage as RealFetchHistoryPage } from '@comfyorg/api-client/jobs/fetchJobs'

export const fetchHistoryPage = vi.fn<typeof RealFetchHistoryPage>()
