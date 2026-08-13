import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { whileMouseDown } from './mouseDownUtil'

describe('whileMouseDown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not repeat when released before the initial delay', () => {
    const element = document.createElement('button')
    const callback = vi.fn()

    whileMouseDown(element, callback, 30, 300)
    vi.advanceTimersByTime(299)
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    vi.advanceTimersByTime(300)

    expect(callback).not.toHaveBeenCalled()
  })

  it('repeats after the initial delay and stops on release', () => {
    const element = document.createElement('button')
    const callback = vi.fn()

    whileMouseDown(element, callback, 30, 300)
    vi.advanceTimersByTime(300)
    expect(callback).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(60)
    expect(callback).toHaveBeenCalledTimes(3)

    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    vi.advanceTimersByTime(300)

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('does not start repeating when the first callback releases the mouse', () => {
    const element = document.createElement('button')
    const callback = vi.fn(() => {
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    whileMouseDown(element, callback, 30, 300)
    vi.advanceTimersByTime(300)
    vi.advanceTimersByTime(300)

    expect(callback).toHaveBeenCalledOnce()
  })
})
