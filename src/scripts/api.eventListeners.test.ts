import { afterEach, describe, expect, it, vi } from 'vitest'

import { ComfyApi } from '@/scripts/api'

describe('ComfyApi event listener error isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not let a throwing listener abort dispatch to other listeners', () => {
    const api = new ComfyApi()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const calls: string[] = []

    api.addEventListener('reconnected', () => {
      calls.push('a')
      throw new Error('boom from a custom node')
    })
    api.addEventListener('reconnected', () => {
      calls.push('b')
    })

    expect(() => api.dispatchCustomEvent('reconnected')).not.toThrow()
    // The second listener still runs even though the first threw.
    expect(calls).toEqual(['a', 'b'])
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain('reconnected')
    // The thrown error itself is logged (second arg) for debugging.
    expect(warn.mock.calls[0][1]).toBeInstanceOf(Error)
  })

  it('preserves the native `this` binding when invoking listeners', () => {
    const api = new ComfyApi()
    let receivedThis: unknown
    api.addEventListener('reconnected', function (this: unknown) {
      receivedThis = this
    })
    api.dispatchCustomEvent('reconnected')
    // Native EventTarget binds `this` to the target; the wrapper must too.
    expect(receivedThis).toBe(api)
  })

  it('guards async listener rejections and logs the error object', async () => {
    const api = new ComfyApi()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = new Error('async boom')

    api.addEventListener('reconnected', () => Promise.reject(err))
    api.dispatchCustomEvent('reconnected')

    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(warn.mock.calls[0][1]).toBe(err)
  })

  it('guards bare PromiseLike thenables (no .catch method) without throwing', async () => {
    const api = new ComfyApi()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = new Error('thenable boom')

    api.addEventListener('reconnected', () => ({
      then(_onFulfilled: unknown, onRejected: (e: unknown) => void) {
        onRejected(err)
        return this
      }
    }))
    expect(() => api.dispatchCustomEvent('reconnected')).not.toThrow()

    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(warn.mock.calls[0][1]).toBe(err)
  })

  it('supports EventListenerObject ({ handleEvent }) listeners', () => {
    const api = new ComfyApi()
    const handleEvent = vi.fn()

    api.addEventListener('reconnected', {
      handleEvent
    } as unknown as () => void)
    api.dispatchCustomEvent('reconnected')

    expect(handleEvent).toHaveBeenCalledOnce()
  })

  it('logs at warn, not error (RUM collects console.error by default)', () => {
    const api = new ComfyApi()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    api.addEventListener('reconnected', () => {
      throw new Error('boom')
    })
    api.dispatchCustomEvent('reconnected')

    expect(error).not.toHaveBeenCalled()
  })

  it('removeEventListener still removes a guarded listener', () => {
    const api = new ComfyApi()
    const handler = vi.fn()

    api.addEventListener('reconnected', handler)
    api.dispatchCustomEvent('reconnected')
    expect(handler).toHaveBeenCalledTimes(1)

    api.removeEventListener('reconnected', handler)
    api.dispatchCustomEvent('reconnected')
    // Not called a second time — the wrapper was matched and removed.
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
