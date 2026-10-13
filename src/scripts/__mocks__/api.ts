import { vi } from 'vitest'

import type { api as RealApi } from '../api'

export const api: Pick<
  typeof RealApi,
  | 'addEventListener'
  | 'addSocketAuth'
  | 'apiURL'
  | 'fetchApi'
  | 'getServerFeature'
  | 'removeEventListener'
  | 'storeSetting'
> = {
  addEventListener: vi.fn(),
  addSocketAuth: vi.fn(async () => true),
  apiURL: vi.fn((url) => (url.startsWith('/api') ? url : `/api${url}`)),
  fetchApi: vi.fn(),
  getServerFeature: vi.fn(),
  removeEventListener: vi.fn(),
  storeSetting: vi.fn()
}
