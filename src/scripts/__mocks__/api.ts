import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type { api as RealApi } from '../api'

export const api = fromPartial<typeof RealApi>({
  addEventListener: vi.fn(),
  apiURL: vi.fn((url: string) => url),
  fetchApi: vi.fn(),
  getServerFeature: vi.fn(),
  removeEventListener: vi.fn()
})
