import { describe, expect, it, vi } from 'vitest'

import type { PaparazziRequest } from './contract'
import type { PaparazziRender } from './mock-run'
import {
  EXAMPLE_SCENE_TOKEN,
  PAPARAZZI_EXAMPLE,
  runPaparazzi
} from './mock-run'
import { SCENE_PLACES } from './scenes'

vi.mock(import('./render'), () => ({
  renderPaparazziImage: vi.fn(() => Promise.resolve(undefined))
}))

const [redCarpet, beach] = SCENE_PLACES

const request = (fields: Partial<PaparazziRequest> = {}): PaparazziRequest => ({
  user: PAPARAZZI_EXAMPLE.url,
  celebrity: 'Nova Reyes',
  sceneToken: EXAMPLE_SCENE_TOKEN,
  resolution: '2K',
  seed: 42,
  ...fields
})

async function finish(run: Promise<unknown>) {
  await vi.runAllTimersAsync()
  return run
}

describe('runPaparazzi', () => {
  it('answers the worked example with its prepared photo', async () => {
    vi.useFakeTimers()
    const render = vi.fn<PaparazziRender>()

    await expect(
      finish(runPaparazzi(request(), new AbortController().signal, render))
    ).resolves.toEqual({
      url: '/images/apps/paparazzi-me/example-result.jpg',
      seed: 42
    })
    expect(render).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'stands the face in another candidate',
      fields: { sceneToken: 'nova-reyes/beach' },
      scene: beach,
      rendered: 'blob:shot',
      url: 'blob:shot'
    },
    {
      name: 'stands an upload in the first candidate before a look-up',
      fields: { user: 'blob:face', sceneToken: undefined },
      scene: redCarpet,
      rendered: 'blob:shot',
      url: 'blob:shot'
    },
    {
      name: 'uses the uploaded scene over the token',
      fields: { scene: 'blob:scene' },
      scene: { url: 'blob:scene', you: 0.3 },
      rendered: 'blob:shot',
      url: 'blob:shot'
    },
    {
      name: 'falls back to the scene photo where it cannot draw',
      fields: { celebrity: 'Sable Quinn', sceneToken: 'sable-quinn/beach' },
      scene: beach,
      rendered: undefined,
      url: beach.url
    }
  ])('$name', async ({ fields, scene, rendered, url }) => {
    vi.useFakeTimers()
    const render = vi.fn<PaparazziRender>(() => Promise.resolve(rendered))

    await expect(
      finish(
        runPaparazzi(request(fields), new AbortController().signal, render)
      )
    ).resolves.toEqual({ url, seed: 42 })
    expect(render).toHaveBeenCalledWith(
      scene,
      request(fields).user,
      expect.objectContaining({ cx: expect.any(Number) }),
      '2K'
    )
  })

  it('releases a rendered photo when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runPaparazzi(
      request({ user: 'blob:face' }),
      controller.signal,
      () => Promise.resolve('blob:shot')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:shot')
  })
})
