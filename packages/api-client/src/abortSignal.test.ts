import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  combineAbortSignals,
  createTimeoutSignal,
  throwIfAborted
} from './abortSignal'

const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
const nativeTimeout = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')
const nativeThrowIfAborted = Object.getOwnPropertyDescriptor(
  AbortSignal.prototype,
  'throwIfAborted'
)

function removeAbortSignalAny(): void {
  Object.defineProperty(AbortSignal, 'any', {
    configurable: true,
    value: undefined
  })
}

function removeThrowIfAborted(): void {
  Object.defineProperty(AbortSignal.prototype, 'throwIfAborted', {
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
  if (nativeThrowIfAborted)
    Object.defineProperty(
      AbortSignal.prototype,
      'throwIfAborted',
      nativeThrowIfAborted
    )
  else Reflect.deleteProperty(AbortSignal.prototype, 'throwIfAborted')
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

describe('throwIfAborted', () => {
  it('does nothing for a live or missing signal without signal.throwIfAborted', () => {
    removeThrowIfAborted()

    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow()
    expect(() => throwIfAborted(undefined)).not.toThrow()
  })

  it('throws the abort reason without signal.throwIfAborted', () => {
    removeThrowIfAborted()
    const controller = new AbortController()
    const reason = new DOMException('Stopped', 'AbortError')
    controller.abort(reason)

    expect(() => throwIfAborted(controller.signal)).toThrow(reason)
  })

  it('throws a null abort reason as is, like the native method', () => {
    removeThrowIfAborted()
    const controller = new AbortController()
    controller.abort(null)

    let thrown: unknown = 'nothing thrown'
    try {
      throwIfAborted(controller.signal)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeNull()
  })

  it('throws an AbortError when the runtime records no abort reason', () => {
    const controller = new AbortController()
    controller.abort()
    vi.spyOn(AbortSignal.prototype, 'reason', 'get').mockReturnValue(undefined)

    expect(() => throwIfAborted(controller.signal)).toThrow(
      expect.objectContaining({ name: 'AbortError' })
    )
  })
})
