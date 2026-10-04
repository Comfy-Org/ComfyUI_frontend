import { vi } from 'vitest'

import type { api as RealApi } from '../api'

export const api: Pick<
  typeof RealApi,
  | 'addEventListener'
  | 'apiURL'
  | 'fetchApi'
  | 'getHistory'
  | 'getQueue'
  | 'getServerFeature'
  | 'removeEventListener'
  | 'storeSetting'
> = {
  addEventListener: vi.fn(),
  apiURL: vi.fn((url) => (url.startsWith('/api') ? url : `/api${url}`)),
  fetchApi: vi.fn(),
  getHistory: vi.fn(async () => []),
  getQueue: vi.fn(async () => ({ Running: [], Pending: [] })),
  getServerFeature: vi.fn(),
  removeEventListener: vi.fn(),
  storeSetting: vi.fn()
}
