import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, vi } from 'vitest'

import { callListener, createListeners } from './listeners'

describe('listener sets', () => {
  it('calls listeners in the order they were added', () => {
    const listeners = createListeners('test')
    const calls: string[] = []
    listeners.add(() => calls.push('first'))
    listeners.add(() => calls.push('second'))

    listeners.drain()

    expect(calls).toEqual(['first', 'second'])
  })

  it('reports a listener that throws and still calls the rest', () => {
    const listeners = createListeners('onReady')
    const broken = new Error('pack listener failed')
    const after = vi.fn()
    listeners.add(() => {
      throw broken
    })
    listeners.add(after)

    listeners.drain()

    expect(after).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(broken, {
      errorType: 'node_api_listener_failure',
      surface: 'platform',
      tags: { event: 'onReady' }
    })
  })

  it('removes only the registration a disposer came from', () => {
    const listeners = createListeners('test')
    const listener = vi.fn()
    const stopFirst = listeners.add(listener)
    listeners.add(listener)

    stopFirst()
    stopFirst()
    listeners.drain()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('calls each listener once when drained, then forgets it', () => {
    const listeners = createListeners('test')
    const listener = vi.fn()
    listeners.add(listener)

    listeners.drain()
    listeners.drain()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('keeps a listener added while draining for the next drain', () => {
    const listeners = createListeners('test')
    const added = vi.fn()
    listeners.add(() => listeners.add(added))

    listeners.drain()

    expect(added).not.toHaveBeenCalled()

    listeners.drain()

    expect(added).toHaveBeenCalledOnce()
  })

  it('skips a listener that an earlier one unsubscribed in the same drain', () => {
    const listeners = createListeners('test')
    const later = vi.fn()
    listeners.add(() => stopLater())
    const stopLater = listeners.add(later)
    const control = vi.fn()
    listeners.add(control)

    listeners.drain()

    expect(later).not.toHaveBeenCalled()
    expect(control).toHaveBeenCalledOnce()
  })

  it('keeps each listener when notifying, and calls it each time', () => {
    const listeners = createListeners('test')
    const listener = vi.fn()
    const stop = listeners.add(listener)

    listeners.notify()
    listeners.notify()
    stop()
    listeners.notify()

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('keeps a listener added while notifying for the next notice, and skips one removed', () => {
    const listeners = createListeners('test')
    const added = vi.fn()
    const later = vi.fn()
    listeners.add(() => {
      listeners.add(added)
      stopLater()
    })
    const stopLater = listeners.add(later)

    listeners.notify()

    expect(added).not.toHaveBeenCalled()
    expect(later).not.toHaveBeenCalled()

    listeners.notify()

    expect(added).toHaveBeenCalledOnce()
  })
})

describe('calling a pack callback', () => {
  it('gives what the callback returns', () => {
    expect(callListener('test', () => 7)).toBe(7)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a callback that throws, once, and gives undefined', () => {
    const broken = new Error('callback failed')

    expect(
      callListener('onCreated', () => {
        throw broken
      })
    ).toBeUndefined()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(broken, {
      errorType: 'node_api_listener_failure',
      surface: 'platform',
      tags: { event: 'onCreated' }
    })
  })

  it('reports a callback whose promise rejects, and gives the promise', async () => {
    const broken = new Error('async callback failed')
    const rejected = Promise.reject(broken)

    expect(callListener('onCreated', () => rejected)).toBe(rejected)
    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledExactlyOnceWith(broken, {
        errorType: 'node_api_listener_failure',
        surface: 'platform',
        tags: { event: 'onCreated' }
      })
    )
  })
})
