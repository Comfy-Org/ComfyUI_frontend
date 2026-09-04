import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  globalThis.document?.body.replaceChildren()
  globalThis.window?.history.replaceState({}, '', '/')
  // Node >= 25 enables the Web Storage API by default, and its built-in
  // localStorage object has no clear() unless --localstorage-file points at a
  // valid path. Test files run under whatever environment each declares, so
  // the lookup can see the Node built-in instead of happy-dom's Storage; skip
  // cleanup there rather than crashing the whole file (same optional-call
  // style as the document/window lookups above).
  globalThis.localStorage?.clear?.()
  globalThis.sessionStorage?.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})
