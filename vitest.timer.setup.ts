import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  globalThis.localStorage?.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})
