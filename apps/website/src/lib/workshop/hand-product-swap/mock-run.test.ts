import { describe, expect, it, vi } from 'vitest'

import { swapRequest } from './contract'
import { EXAMPLE_PRODUCTS, HAND_EXAMPLE } from './examples'
import { runHandSwap } from './mock-run'

const DIR = '/images/apps/hand-product-swap'

function requestFor(handUrl: string, productUrl: string) {
  return swapRequest({
    hand: { url: handUrl, width: 1200, height: 896 },
    productUrl,
    region: HAND_EXAMPLE.region,
    resolution: '2K',
    seed: 42
  })
}

async function settle(run: Promise<unknown>) {
  await vi.runAllTimersAsync()
  return run
}

describe('runHandSwap', () => {
  it.for([
    { product: 'product-can.jpg', result: `${DIR}/result-can.jpg` },
    { product: 'product-serum.jpg', result: `${DIR}/result-serum.jpg` },
    { product: 'product-tube.jpg', result: `${DIR}/result-tube.jpg` }
  ])(
    'answers the example hand holding $product with its example photo',
    async ({ product, result }) => {
      vi.useFakeTimers()
      const render = vi.fn(() => Promise.resolve('blob:swapped'))
      const run = runHandSwap(
        requestFor(HAND_EXAMPLE.url, `${DIR}/${product}`),
        new AbortController().signal,
        render
      )

      await expect(settle(run)).resolves.toEqual({ url: result, seed: 42 })
      expect(render).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      name: 'composites an example product into an uploaded hand',
      hand: 'blob:hand',
      product: EXAMPLE_PRODUCTS[0].url,
      rendered: 'blob:swapped',
      expected: 'blob:swapped'
    },
    {
      name: 'composites an uploaded product into the example hand',
      hand: HAND_EXAMPLE.url,
      product: 'blob:product',
      rendered: 'blob:swapped',
      expected: 'blob:swapped'
    },
    {
      name: 'falls back to the hand photo where it cannot draw',
      hand: 'blob:hand',
      product: 'blob:product',
      rendered: undefined,
      expected: 'blob:hand'
    }
  ])('$name', async ({ hand, product, rendered, expected }) => {
    vi.useFakeTimers()
    const request = requestFor(hand, product)
    const render = vi.fn(() => Promise.resolve(rendered))
    const run = runHandSwap(request, new AbortController().signal, render)

    await expect(settle(run)).resolves.toEqual({ url: expected, seed: 42 })
    expect(render).toHaveBeenCalledWith(request)
  })

  it('releases a drawn image when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()
    const run = runHandSwap(
      requestFor('blob:hand', 'blob:product'),
      controller.signal,
      () => Promise.resolve('blob:swapped')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:swapped')
  })
})
