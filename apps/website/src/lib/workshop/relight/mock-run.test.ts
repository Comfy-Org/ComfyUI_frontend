import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_GENERATION, DEFAULT_SCENE, newLight, newMask } from './lights'
import type { RelightRender } from './mock-run'
import { RELIGHT_EXAMPLE, relightRequest, runRelight } from './mock-run'

const request = (imageUrl: string) =>
  relightRequest(
    imageUrl,
    [newLight('a', 'A', 0)],
    [{ ...newMask('m', 'Subject', 0), visible: true }],
    DEFAULT_SCENE,
    { ...DEFAULT_GENERATION, seed: 42 }
  )

describe('relightRequest', () => {
  it('sends the mask areas without whether they are drawn on the photo', () => {
    const sent = request('/photo.jpg')
    expect(sent.masks).toEqual([
      { id: 'm', name: 'Subject', cx: 0.5, cy: 0.52, rx: 0.3, ry: 0.6 }
    ])
    expect(sent.generation.seed).toBe(42)
  })
})

describe('runRelight', () => {
  it.for([
    {
      name: 'answers with the rendered image',
      rendered: 'blob:relit',
      url: RELIGHT_EXAMPLE.url,
      expected: 'blob:relit'
    },
    {
      name: 'falls back to the relit example where it cannot render',
      rendered: undefined,
      url: RELIGHT_EXAMPLE.url,
      expected: '/images/apps/relight/example-relit.jpg'
    },
    {
      name: 'falls back to the photo itself for an upload',
      rendered: undefined,
      url: 'blob:upload',
      expected: 'blob:upload'
    }
  ])('$name', async ({ rendered, url, expected }) => {
    vi.useFakeTimers()
    const render: RelightRender = () => Promise.resolve(rendered)

    const run = runRelight(request(url), new AbortController().signal, render)
    await vi.runAllTimersAsync()

    await expect(run).resolves.toEqual({ url: expected, seed: 42 })
  })

  it('releases a rendered image when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runRelight(
      request(RELIGHT_EXAMPLE.url),
      controller.signal,
      () => Promise.resolve('blob:relit')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:relit')
  })
})
