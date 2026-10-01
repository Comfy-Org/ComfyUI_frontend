import { describe, expect, it, vi } from 'vitest'

import { swapRequest } from './contract'
import { runHandSwap } from './mock-run'

const request = swapRequest({
  hand: { url: 'blob:hand', width: 1200, height: 900 },
  productUrl: '/can.png',
  region: { x: 0.4, y: 0.3, w: 0.2, h: 0.4 },
  resolution: '2K',
  seed: 42
})

describe('runHandSwap', () => {
  it.for([
    {
      name: 'answers with the composited image',
      rendered: 'blob:swapped',
      expected: 'blob:swapped'
    },
    {
      name: 'falls back to the hand photo where it cannot draw',
      rendered: undefined,
      expected: 'blob:hand'
    }
  ])('$name', async ({ rendered, expected }) => {
    vi.useFakeTimers()
    const run = runHandSwap(request, new AbortController().signal, () =>
      Promise.resolve(rendered)
    )
    await vi.runAllTimersAsync()
    await expect(run).resolves.toEqual({ url: expected, seed: 42 })
  })

  it('releases a drawn image when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()
    const run = runHandSwap(request, controller.signal, () =>
      Promise.resolve('blob:swapped')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:swapped')
  })
})
