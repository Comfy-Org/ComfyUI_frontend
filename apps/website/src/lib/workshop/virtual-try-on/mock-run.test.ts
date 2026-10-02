import { describe, expect, it, vi } from 'vitest'

import type { TryOnFit, TryOnRequest } from './contract'
import { EXAMPLE_GARMENTS, UPLOAD_FABRIC } from './garments'
import type { TryOnRender } from './mock-run'
import { TRY_ON_PERSON, mockProgress, runTryOn, tryOnScene } from './mock-run'

vi.mock(import('./render-image'), () => ({
  renderTryOn: vi.fn(() => Promise.resolve(undefined))
}))

const breton = EXAMPLE_GARMENTS[0]

const tryOnRequest = (
  person: string,
  garment: string,
  fit: TryOnFit,
  seed: number
): TryOnRequest => ({ person, garment, fit, seed })

describe('mockProgress', () => {
  it.for([
    { elapsed: 0, expected: { stage: 'queued' } },
    { elapsed: 400, expected: { stage: 'running', percent: 0 } },
    { elapsed: 1400, expected: { stage: 'running', percent: 50 } },
    { elapsed: 9000, expected: { stage: 'running', percent: 99 } }
  ])('is $expected.stage after $elapsed ms', ({ elapsed, expected }) => {
    expect(mockProgress(elapsed)).toEqual(expected)
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
  const request = tryOnRequest('blob:me', breton.url, 'regular', 42)

  async function finish(run: Promise<unknown>) {
    await vi.runAllTimersAsync()
    return run
  }

  it.for(EXAMPLE_GARMENTS.map(({ id, url }) => ({ id, url })))(
    'answers the example person in the $id garment with its example photo',
    async ({ id, url }) => {
      vi.useFakeTimers()
      const render = vi.fn<TryOnRender>()

      const run = runTryOn(
        tryOnRequest(TRY_ON_PERSON.url, url, 'slim', 3),
        new AbortController().signal,
        render
      )

      await expect(finish(run)).resolves.toEqual({
        url: `/images/apps/virtual-try-on/result-${id}.jpg`,
        seed: 3
      })
      expect(render).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      name: 'draws an uploaded person in an example garment',
      request,
      rendered: 'blob:dressed',
      expected: 'blob:dressed'
    },
    {
      name: 'draws the example person in an uploaded garment',
      request: tryOnRequest(TRY_ON_PERSON.url, 'blob:shirt', 'regular', 42),
      rendered: 'blob:dressed',
      expected: 'blob:dressed'
    },
    {
      name: 'falls back to the photo where it cannot draw',
      request,
      rendered: undefined,
      expected: 'blob:me'
    }
  ])('$name', async ({ request, rendered, expected }) => {
    vi.useFakeTimers()
    const render = vi.fn<TryOnRender>(() => Promise.resolve(rendered))

    const run = runTryOn(request, new AbortController().signal, render)

    await expect(finish(run)).resolves.toEqual({ url: expected, seed: 42 })
    expect(render).toHaveBeenCalledWith(request, tryOnScene(request))
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
