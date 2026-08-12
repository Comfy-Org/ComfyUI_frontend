import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  globalThis.document?.body.replaceChildren()
  globalThis.localStorage?.clear()
  globalThis.sessionStorage?.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})
