import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { chainCallback, rebaseChainCallback } from './chainCallback'

describe('chainCallback', () => {
  it.for([
    {
      name: 'present',
      original: (value: number) => `v${value}`,
      expected: 'v7'
    },
    { name: 'absent', original: undefined, expected: undefined }
  ])(
    'returns the result of a $name original callback',
    ({ original, expected }) => {
      const result = chainCallback(original)(7)

      expectTypeOf(result).toEqualTypeOf<string | undefined>()
      expect(result).toBe(expected)
    }
  )
})

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
    const original = vi.fn()
    const handWrittenChain = () => original()

    expect(rebaseChainCallback(handWrittenChain, original, original)).toBe(
      handWrittenChain
    )
  })

  it('returns a plain call signature for richer callable values', () => {
    const callback = Object.assign(() => undefined, { marker: true })

    const rebased = rebaseChainCallback(callback, undefined, callback)

    expectTypeOf(rebased).toEqualTypeOf<(() => void) | undefined>()
  })
})
