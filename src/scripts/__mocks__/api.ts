import { vi } from 'vitest'

import type { api as RealApi } from '../api'

export const api = {
  addEventListener: vi.fn<typeof RealApi.addEventListener>(),
  apiURL: vi.fn<typeof RealApi.apiURL>((url) => url),
  fetchApi: vi.fn<typeof RealApi.fetchApi>(),
  getServerFeature: vi.fn<typeof RealApi.getServerFeature>(),
  removeEventListener: vi.fn<typeof RealApi.removeEventListener>()
}
