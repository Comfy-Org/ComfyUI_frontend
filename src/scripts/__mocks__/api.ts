import { vi } from 'vitest'

import type { api as RealApi } from '../api'

export const api: Pick<
  typeof RealApi,
  | 'addEventListener'
  | 'apiURL'
  | 'fetchApi'
  | 'getServerFeature'
  | 'removeEventListener'
> = {
  addEventListener: vi.fn(),
  apiURL: vi.fn((url) => (url.startsWith('/api') ? url : `/api${url}`)),
  fetchApi: vi.fn(),
  getServerFeature: vi.fn(),
  removeEventListener: vi.fn()
}
