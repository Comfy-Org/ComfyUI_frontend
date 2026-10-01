import { describe, expect, it, vi } from 'vitest'

import { paparazziRequest } from './contract'
import type { PaparazziRender } from './mock-run'
import { PAPARAZZI_EXAMPLE, faceCrop, runPaparazzi } from './mock-run'
import { DEFAULT_SETUP } from './setup'

vi.mock(import('./render'), () => ({
  renderPaparazziImage: vi.fn(() => Promise.resolve(undefined))
}))

const request = (faceUrl: string) =>
  paparazziRequest(faceUrl, { ...DEFAULT_SETUP, seed: 42 })

describe('runPaparazzi', () => {
  it.for([
    {
      name: 'answers with the rendered photo',
      rendered: 'blob:shot',
      url: PAPARAZZI_EXAMPLE.url,
      expected: 'blob:shot'
    },
    {
      name: 'falls back to the example shot where it cannot render',
      rendered: undefined,
      url: PAPARAZZI_EXAMPLE.url,
      expected: '/images/apps/paparazzi-me/example-result.jpg'
    },
    {
      name: 'falls back to the face itself for an upload',
      rendered: undefined,
      url: 'blob:face',
      expected: 'blob:face'
    }
  ])('$name', async ({ rendered, url, expected }) => {
    vi.useFakeTimers()
    const render = vi.fn<PaparazziRender>(() => Promise.resolve(rendered))

    const run = runPaparazzi(request(url), new AbortController().signal, render)
    await vi.runAllTimersAsync()

    await expect(run).resolves.toEqual({ url: expected, seed: 42 })
    expect(render).toHaveBeenCalledWith(request(url), faceCrop(url))
  })

  it('releases a rendered photo when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runPaparazzi(
      request(PAPARAZZI_EXAMPLE.url),
      controller.signal,
      () => Promise.resolve('blob:shot')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:shot')
  })
})
