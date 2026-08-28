import { vi } from 'vitest'

import type {
  getApp as GetApp,
  initializeApp as InitializeApp
} from 'firebase/app'

export const getApp = vi.fn<typeof GetApp>()
export const initializeApp = vi.fn<typeof InitializeApp>()
