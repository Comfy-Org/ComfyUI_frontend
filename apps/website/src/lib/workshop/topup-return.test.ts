import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  announceTopUpReturnFromLocation,
  subscribeToTopUpReturns,
  topUpReturnUrl
} from './topup-return'

describe('topUpReturnUrl', () => {
  it('adds an attempt marker without losing the model page state', () => {
    expect(
      topUpReturnUrl(
        'https://comfy.org/models/foo?q=bar#playground',
        'attempt_1'
      )
    ).toBe(
      'https://comfy.org/models/foo?q=bar&workshopTopUpReturn=attempt_1#playground'
    )
  })

  it.for(['', '../escape', 'contains space', 'a'.repeat(65)])(
    'rejects an invalid attempt marker: %s',
    (attemptId) => {
      expect(() =>
        topUpReturnUrl('https://comfy.org/models/foo', attemptId)
      ).toThrow('Invalid checkout attempt')
    }
  )
})

describe('subscribeToTopUpReturns', () => {
  it('accepts only a same-origin, well-formed return message', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToTopUpReturns(listener)

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://other.example',
        data: { type: 'workshop-topup-return', attemptId: 'wrong-origin' }
      })
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'workshop-topup-return', attemptId: '../invalid' }
      })
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'workshop-topup-return', attemptId: 'attempt-1' }
      })
    )

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith('attempt-1')
    unsubscribe()
  })

  it('falls back to storage events when BroadcastChannel cannot start', () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('blocked')
        }
      }
    )
    onTestFinished(() => {
      vi.unstubAllGlobals()
    })
    const listener = vi.fn()
    const unsubscribe = subscribeToTopUpReturns(listener)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'comfy-workshop-topup-return',
        newValue: JSON.stringify({
          type: 'workshop-topup-return',
          attemptId: 'attempt-2'
        })
      })
    )

    expect(listener).toHaveBeenCalledWith('attempt-2')
    unsubscribe()
  })
})

describe('announceTopUpReturnFromLocation', () => {
  it('removes the marker and broadcasts the return', () => {
    const postMessage = vi.fn()
    const closeChannel = vi.fn()
    const closeWindow = vi.spyOn(window, 'close').mockImplementation(() => {})
    onTestFinished(() => closeWindow.mockRestore())
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        postMessage = postMessage
        close = closeChannel
      }
    )
    window.history.replaceState(
      {},
      '',
      '/models/foo?q=bar&workshopTopUpReturn=attempt-1#playground'
    )

    announceTopUpReturnFromLocation()

    expect(window.location.href).toBe(
      `${window.location.origin}/models/foo?q=bar#playground`
    )
    expect(postMessage).toHaveBeenCalledWith({
      type: 'workshop-topup-return',
      attemptId: 'attempt-1'
    })
    expect(closeChannel).toHaveBeenCalledOnce()
    expect(closeWindow).toHaveBeenCalledOnce()
  })

  it('still closes after a blocked BroadcastChannel constructor', () => {
    const closeWindow = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('blocked')
        }
      }
    )
    onTestFinished(() => {
      closeWindow.mockRestore()
      vi.unstubAllGlobals()
    })
    window.history.replaceState(
      {},
      '',
      '/models/foo?workshopTopUpReturn=attempt-2'
    )

    expect(() => announceTopUpReturnFromLocation()).not.toThrow()
    expect(closeWindow).toHaveBeenCalledOnce()
  })
})
