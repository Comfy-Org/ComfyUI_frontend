import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { whileMouseDown } from '@/utils/mouseDownUtil'

describe('whileMouseDown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs until the element receives mouseup', () => {
    const element = document.createElement('button')
    const callback = vi.fn()

    whileMouseDown(element, callback, 10)
    vi.advanceTimersByTime(25)
    element.dispatchEvent(new MouseEvent('mouseup'))
    vi.advanceTimersByTime(30)

    expect(callback.mock.calls).toEqual([[0], [1]])
  })

  it('uses the event target and stops on document mouseup', () => {
    const element = document.createElement('button')
    const event = new MouseEvent('mousedown')
    Object.defineProperty(event, 'target', { value: element })
    const callback = vi.fn()

    whileMouseDown(event, callback, 5)
    vi.advanceTimersByTime(12)
    document.dispatchEvent(new MouseEvent('mouseup'))
    vi.advanceTimersByTime(20)

    expect(callback.mock.calls).toEqual([[0], [1]])
  })
})
