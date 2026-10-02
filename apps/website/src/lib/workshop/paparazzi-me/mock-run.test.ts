import { describe, expect, it, vi } from 'vitest'

import { paparazziRequest } from './contract'
import type { PaparazziRender } from './mock-run'
import { PAPARAZZI_EXAMPLE, faceCrop, runPaparazzi } from './mock-run'
import type { PaparazziSetup } from './setup'
import { DEFAULT_SETUP, SCENE_IDS } from './setup'

vi.mock(import('./render'), () => ({
  renderPaparazziImage: vi.fn(() => Promise.resolve(undefined))
}))

const request = (faceUrl: string, setup: Partial<PaparazziSetup> = {}) =>
  paparazziRequest(faceUrl, { ...DEFAULT_SETUP, seed: 42, ...setup })

async function finish(run: Promise<unknown>) {
  await vi.runAllTimersAsync()
  return run
}

describe('runPaparazzi', () => {
  it.for(SCENE_IDS)(
    'answers the example in the %s scene with its example photo',
    async (scene) => {
      vi.useFakeTimers()
      const render = vi.fn<PaparazziRender>()

      const run = runPaparazzi(
        request(PAPARAZZI_EXAMPLE.url, { scene }),
        new AbortController().signal,
        render
      )

      await expect(finish(run)).resolves.toEqual({
        url: `/images/apps/paparazzi-me/result-${scene}.jpg`,
        seed: 42
      })
      expect(render).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      name: 'draws the example face with another star',
      rendered: 'blob:shot',
      url: PAPARAZZI_EXAMPLE.url,
      setup: { celebrity: 'Sable Quinn' },
      expected: 'blob:shot'
    },
    {
      name: 'draws the example in a scene of its own',
      rendered: 'blob:shot',
      url: PAPARAZZI_EXAMPLE.url,
      setup: { sceneOverride: 'on a yacht' },
      expected: 'blob:shot'
    },
    {
      name: 'falls back to the example shot where it cannot draw',
      rendered: undefined,
      url: PAPARAZZI_EXAMPLE.url,
      setup: { celebrity: 'Sable Quinn' },
      expected: '/images/apps/paparazzi-me/example-result.jpg'
    },
    {
      name: 'falls back to the face itself for an upload',
      rendered: undefined,
      url: 'blob:face',
      setup: {},
      expected: 'blob:face'
    }
  ])('$name', async ({ rendered, url, setup, expected }) => {
    vi.useFakeTimers()
    const render = vi.fn<PaparazziRender>(() => Promise.resolve(rendered))

    const run = runPaparazzi(
      request(url, setup),
      new AbortController().signal,
      render
    )

    await expect(finish(run)).resolves.toEqual({ url: expected, seed: 42 })
    expect(render).toHaveBeenCalledWith(request(url, setup), faceCrop(url))
  })

  it('releases a rendered photo when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runPaparazzi(request('blob:face'), controller.signal, () =>
      Promise.resolve('blob:shot')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:shot')
  })
})
