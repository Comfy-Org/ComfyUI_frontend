import { afterEach, describe, expect, it, vi } from 'vitest'

import { combineAbortSignals, createTimeoutSignal } from './abortSignal'

const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
const nativeTimeout = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')

function removeStaticAbortSignalHelpers(): void {
  Object.defineProperty(AbortSignal, 'any', {
    configurable: true,
    value: undefined
  })
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: undefined
  })
}

function restoreStaticAbortSignalHelpers(): void {
  if (nativeAny) Object.defineProperty(AbortSignal, 'any', nativeAny)
  else Reflect.deleteProperty(AbortSignal, 'any')
  if (nativeTimeout)
    Object.defineProperty(AbortSignal, 'timeout', nativeTimeout)
  else Reflect.deleteProperty(AbortSignal, 'timeout')
}

describe('abort signal compatibility', () => {
  afterEach(() => {
    restoreStaticAbortSignalHelpers()
  })

  it('preserves caller cancellation without AbortSignal.any', () => {
    removeStaticAbortSignalHelpers()
    const caller = new AbortController()
    const other = new AbortController()
    const reason = new DOMException('Caller stopped', 'AbortError')
    const combined = combineAbortSignals([other.signal, caller.signal])

    caller.abort(reason)

    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
  })

  it('preserves an existing cancellation without AbortSignal.any', () => {
    removeStaticAbortSignalHelpers()
    const caller = new AbortController()
    const reason = new DOMException('Already stopped', 'AbortError')
    caller.abort(reason)

    const combined = combineAbortSignals([caller.signal])

    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
  })

  it('enforces timeouts without AbortSignal.timeout', async () => {
    vi.useFakeTimers()
    removeStaticAbortSignalHelpers()
    const signal = createTimeoutSignal(25)

    await vi.advanceTimersByTimeAsync(24)
    expect(signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(signal.aborted).toBe(true)
    expect(signal.reason).toMatchObject({ name: 'TimeoutError' })
  })
})
