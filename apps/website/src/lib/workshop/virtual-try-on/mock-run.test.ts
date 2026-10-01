import { describe, expect, it, vi } from 'vitest'

import { EXAMPLE_GARMENTS, UPLOAD_FABRIC } from './garments'
import type { TryOnRender } from './mock-run'
import { TRY_ON_PERSON, runTryOn, tryOnRequest, tryOnScene } from './mock-run'

vi.mock(import('./render-image'), () => ({
  renderTryOn: vi.fn(() => Promise.resolve(undefined))
}))

const breton = EXAMPLE_GARMENTS[0]

describe('tryOnRequest', () => {
  it('sends the person, the garment, the fit and the seed', () => {
    expect(tryOnRequest(TRY_ON_PERSON.url, breton.url, 'relaxed', 7)).toEqual({
      personImageUrl: '/images/apps/virtual-try-on/person.jpg',
      garmentImageUrl: '/images/apps/virtual-try-on/garment-breton.jpg',
      fit: 'relaxed',
      seed: 7
    })
  })
})

describe('tryOnScene', () => {
  it('reads an example garment from its known cloth and an upload from its middle', () => {
    expect(
      tryOnScene(tryOnRequest(TRY_ON_PERSON.url, breton.url, 'slim', 1)).fabric
    ).toEqual(breton.fabric)
    expect(
      tryOnScene(tryOnRequest('blob:me', 'blob:shirt', 'slim', 1)).fabric
    ).toEqual(UPLOAD_FABRIC)
  })

  it('draws a wider outline for a looser fit', () => {
    const across = (fit: 'slim' | 'relaxed') => {
      const xs = tryOnScene(
        tryOnRequest(TRY_ON_PERSON.url, breton.url, fit, 1)
      ).outline.map(({ x }) => x)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(across('relaxed')).toBeGreaterThan(across('slim'))
  })
})

describe('runTryOn', () => {
  const request = tryOnRequest(TRY_ON_PERSON.url, breton.url, 'regular', 42)

  it.for([
    {
      name: 'answers with the rendered image',
      rendered: 'blob:dressed',
      expected: 'blob:dressed'
    },
    {
      name: 'falls back to the photo where it cannot render',
      rendered: undefined,
      expected: TRY_ON_PERSON.url
    }
  ])('$name', async ({ rendered, expected }) => {
    vi.useFakeTimers()
    const render: TryOnRender = () => Promise.resolve(rendered)

    const run = runTryOn(request, new AbortController().signal, render)
    await vi.runAllTimersAsync()

    await expect(run).resolves.toEqual({ url: expected, seed: 42 })
  })

  it('releases a rendered image when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runTryOn(request, controller.signal, () =>
      Promise.resolve('blob:dressed')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:dressed')
  })
})
