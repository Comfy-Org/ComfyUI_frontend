import { afterEach, describe, expect, it, vi } from 'vitest'

import { whileMouseDown } from '@/utils/mouseDownUtil'

describe('whileMouseDown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the callback until mouseup is received on the element', () => {
    vi.useFakeTimers()
    const element = document.createElement('button')
    const callback = vi.fn()

    whileMouseDown(element, callback, 10)

    vi.advanceTimersByTime(25)
    element.dispatchEvent(new MouseEvent('mouseup'))
    vi.advanceTimersByTime(30)

    expect(callback.mock.calls.map(([iteration]) => iteration)).toEqual([0, 1])
  })

  it('accepts an event target and can be disposed directly', () => {
    vi.useFakeTimers()
    const element = document.createElement('button')
    const callback = vi.fn()
    const event = new MouseEvent('mousedown')
    Object.defineProperty(event, 'target', { value: element })

    const runner = whileMouseDown(event, callback, 10)
    vi.advanceTimersByTime(10)
    runner.dispose()
    vi.advanceTimersByTime(20)

    expect(callback).toHaveBeenCalledExactlyOnceWith(0)
  })
})
