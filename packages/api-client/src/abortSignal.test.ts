import { afterEach, describe, expect, it, vi } from 'vitest'

import { combineAbortSignals, createTimeoutSignal } from './abortSignal'

const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
const nativeTimeout = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')

function removeAbortSignalAny(): void {
  Object.defineProperty(AbortSignal, 'any', {
    configurable: true,
    value: undefined
  })
}

function removeAbortSignalTimeout(): void {
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: undefined
  })
}

afterEach(() => {
  if (nativeAny) Object.defineProperty(AbortSignal, 'any', nativeAny)
  else Reflect.deleteProperty(AbortSignal, 'any')
  if (nativeTimeout)
    Object.defineProperty(AbortSignal, 'timeout', nativeTimeout)
  else Reflect.deleteProperty(AbortSignal, 'timeout')
})

describe('combineAbortSignals', () => {
  it('aborts when any input signal aborts without AbortSignal.any', () => {
    removeAbortSignalAny()
    const first = new AbortController()
    const second = new AbortController()
    const reason = new DOMException('Stopped', 'AbortError')
    const combined = combineAbortSignals([first.signal, second.signal])

    second.abort(reason)

    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
  })

  it('preserves an existing abort without AbortSignal.any', () => {
    removeAbortSignalAny()
    const controller = new AbortController()
    const reason = new DOMException('Already stopped', 'AbortError')
    controller.abort(reason)

    const combined = combineAbortSignals([controller.signal])

    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
  })
})

describe('createTimeoutSignal', () => {
  it('aborts with a timeout error without AbortSignal.timeout', () => {
    vi.useFakeTimers()
    removeAbortSignalTimeout()
    const signal = createTimeoutSignal(25)

    vi.advanceTimersByTime(24)
    expect(signal.aborted).toBe(false)

    vi.advanceTimersByTime(1)
    expect(signal.aborted).toBe(true)
    expect(signal.reason).toMatchObject({ name: 'TimeoutError' })
  })
})
