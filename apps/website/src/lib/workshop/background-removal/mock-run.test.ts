import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETUP, cutoutRequest } from './contract'
import type { CutoutRender } from './mock-run'
import { runCutout } from './mock-run'

const request = (imageUrl: string) =>
  cutoutRequest(imageUrl, {
    ...DEFAULT_SETUP,
    background: { kind: 'color', color: '#d9ccf5' }
  })

describe('runCutout', () => {
  it.for([
    {
      name: 'answers with the drawn cutout',
      rendered: 'blob:cutout',
      expected: 'blob:cutout'
    },
    {
      name: 'falls back to the photo where it cannot draw',
      rendered: undefined,
      expected: 'blob:upload'
    }
  ])('$name', async ({ rendered, expected }) => {
    vi.useFakeTimers()
    const render: CutoutRender = () => Promise.resolve(rendered)

    const run = runCutout(
      request('blob:upload'),
      new AbortController().signal,
      render
    )
    await vi.runAllTimersAsync()

    await expect(run).resolves.toEqual({
      url: expected,
      mode: 'remove',
      format: 'png',
      transparent: false
    })
  })

  it('says a transparent Remove keeps its alpha', async () => {
    vi.useFakeTimers()
    const run = runCutout(
      cutoutRequest('/photo.jpg', DEFAULT_SETUP),
      new AbortController().signal,
      () => Promise.resolve('blob:cutout')
    )
    await vi.runAllTimersAsync()

    await expect(run).resolves.toMatchObject({ transparent: true })
  })

  it('releases a drawn cutout when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runCutout(request('/photo.jpg'), controller.signal, () =>
      Promise.resolve('blob:cutout')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:cutout')
  })
})
