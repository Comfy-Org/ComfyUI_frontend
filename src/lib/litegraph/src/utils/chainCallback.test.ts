import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { chainCallback, rebaseChainCallback } from './chainCallback'

describe('rebaseChainCallback', () => {
  it('flattens a known nested chain onto the next original', () => {
    const previousOriginal = vi.fn()
    const nextOriginal = vi.fn()
    const firstAppended = vi.fn()
    const secondAppended = vi.fn()
    const firstChain = chainCallback(previousOriginal, firstAppended)
    const current = chainCallback(firstChain, secondAppended)

    const rebased = rebaseChainCallback(current, previousOriginal, nextOriginal)
    rebased?.()

    expect(previousOriginal).not.toHaveBeenCalled()
    expect(nextOriginal).toHaveBeenCalledOnce()
    expect(firstAppended).toHaveBeenCalledOnce()
    expect(secondAppended).toHaveBeenCalledOnce()
  })

  it('appends an opaque local callback after a changed original', () => {
    const previousOriginal = vi.fn()
    const nextOriginal = vi.fn()
    const local = vi.fn()

    const rebased = rebaseChainCallback(local, previousOriginal, nextOriginal)
    rebased?.()

    expect(previousOriginal).not.toHaveBeenCalled()
    expect(nextOriginal).toHaveBeenCalledOnce()
    expect(local).toHaveBeenCalledOnce()
  })

  it('retains an opaque hand-written chain when the original is unchanged', () => {
    let subscribed = true
    const original = vi.fn(() => {
      if (!subscribed) throw new Error('already unsubscribed')
      subscribed = false
    })
    const local = vi.fn()
    const handWrittenChain = () => {
      original()
      local()
    }

    const rebased = rebaseChainCallback(handWrittenChain, original, original)
    rebased?.()

    expect(rebased).toBe(handWrittenChain)
    expect(original).toHaveBeenCalledOnce()
    expect(local).toHaveBeenCalledOnce()
  })

  it('returns a plain call signature for richer callable values', () => {
    const callback = Object.assign(() => undefined, { marker: true })

    const rebased = rebaseChainCallback(callback, undefined, callback)

    expectTypeOf(rebased).toEqualTypeOf<(() => undefined) | undefined>()
  })
})
