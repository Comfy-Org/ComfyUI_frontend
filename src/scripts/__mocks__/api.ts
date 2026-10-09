import { vi } from 'vitest'

import type { api as RealApi } from '../api'

export const api: Pick<
  typeof RealApi,
  | 'addEventListener'
  | 'apiURL'
  | 'clearItems'
  | 'deleteItem'
  | 'fetchApi'
  | 'getHistory'
  | 'getQueue'
  | 'getServerFeature'
  | 'interrupt'
  | 'removeEventListener'
  | 'storeSetting'
> = {
  addEventListener: vi.fn(),
  apiURL: vi.fn((url) => (url.startsWith('/api') ? url : `/api${url}`)),
  clearItems: vi.fn(async () => undefined),
  deleteItem: vi.fn(async () => undefined),
  fetchApi: vi.fn(),
  getHistory: vi.fn(async () => []),
  getQueue: vi.fn(async () => ({ Running: [], Pending: [] })),
  getServerFeature: vi.fn(),
  interrupt: vi.fn(async () => undefined),
  removeEventListener: vi.fn(),
  storeSetting: vi.fn()
}
