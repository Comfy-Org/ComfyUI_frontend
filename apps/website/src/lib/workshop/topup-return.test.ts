import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  announceTopUpReturnFromLocation,
  subscribeToTopUpReturns,
  topUpReturnUrl
} from './topup-return'

describe('topUpReturnUrl', () => {
  it('adds an attempt marker to the checkout return page', () => {
    expect(
      topUpReturnUrl('https://comfy.org/checkout-return', 'attempt_1')
    ).toBe('https://comfy.org/checkout-return?workshopTopUpReturn=attempt_1')
  })

  it.for(['', '../escape', 'contains space', 'a'.repeat(65)])(
    'rejects an invalid attempt marker: %s',
    (attemptId) => {
      expect(() =>
        topUpReturnUrl('https://comfy.org/checkout-return', attemptId)
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
    for (const data of [null, {}, { type: 'workshop-topup-return' }]) {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data
        })
      )
    }
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
        newValue: '{'
      })
    )
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
      '/checkout-return?workshopTopUpReturn=attempt-1'
    )

    announceTopUpReturnFromLocation()

    expect(window.location.href).toBe(
      `${window.location.origin}/checkout-return`
    )
    expect(postMessage).toHaveBeenCalledWith({
      type: 'workshop-topup-return',
      attemptId: 'attempt-1'
    })
    expect(closeChannel).toHaveBeenCalledOnce()
  })

  it('falls back to storage when channel messaging throws', () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('blocked')
        }
      }
    )
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    window.history.replaceState(
      {},
      '',
      '/checkout-return?workshopTopUpReturn=attempt-2'
    )

    announceTopUpReturnFromLocation()

    const message = JSON.stringify({
      type: 'workshop-topup-return',
      attemptId: 'attempt-2'
    })
    expect(setItem).toHaveBeenCalledWith('comfy-workshop-topup-return', message)
    expect(removeItem).toHaveBeenCalledWith('comfy-workshop-topup-return')
  })
})
