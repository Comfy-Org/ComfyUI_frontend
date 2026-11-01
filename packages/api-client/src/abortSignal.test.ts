import { afterEach, describe, expect, it } from 'vitest'

import { combineAbortSignals } from './abortSignal'

const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')

function removeAbortSignalAny(): void {
  Object.defineProperty(AbortSignal, 'any', {
    configurable: true,
    value: undefined
  })
}

describe('combineAbortSignals', () => {
  afterEach(() => {
    if (nativeAny) Object.defineProperty(AbortSignal, 'any', nativeAny)
    else Reflect.deleteProperty(AbortSignal, 'any')
  })

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
