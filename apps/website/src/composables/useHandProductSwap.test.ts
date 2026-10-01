import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { HAND_EXAMPLE } from '../lib/workshop/hand-product-swap/examples'
import { STARTING_BOX } from '../lib/workshop/hand-product-swap/placement'
import { renderSwapImage } from '../lib/workshop/hand-product-swap/render-swap'
import { useHandProductSwap } from './useHandProductSwap'

vi.mock(import('../lib/workshop/hand-product-swap/render-swap'), () => ({
  renderSwapImage: vi.fn(() => Promise.resolve('blob:swapped'))
}))

vi.mock(import('../lib/workshop/image-size'), () => ({
  imageSize: vi.fn(() => Promise.resolve({ width: 800, height: 1000 }))
}))

let scope: EffectScope

function start() {
  const swap = scope.run(() => useHandProductSwap('en'))
  if (!swap) throw new Error('no scope')
  swap.useExample()
  return swap
}

async function finish(swap: ReturnType<typeof useHandProductSwap>) {
  const run = swap.swap()
  await vi.runAllTimersAsync()
  await run
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:upload')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.restoreAllMocks()
})

describe('useHandProductSwap', () => {
  it('opens the example with its can boxed and the sparkling can picked', () => {
    const swap = start()
    expect(swap.setup.value.region).toEqual(HAND_EXAMPLE.region)
    expect(swap.productName.value).toBe('Can')
    expect(swap.canRun.value).toBe(true)
    expect(swap.canUndo.value).toBe(false)
  })

  it('undoes a whole drag of the box as one step, and a product pick', () => {
    const swap = start()
    swap.checkpoint()
    swap.place({ ...HAND_EXAMPLE.region, x: 0.3 })
    swap.place({ ...HAND_EXAMPLE.region, x: 0.2 })
    swap.pickProduct('serum')
    expect(swap.productName.value).toBe('Serum')

    swap.undo()
    expect(swap.productName.value).toBe('Can')
    expect(swap.setup.value.region.x).toBe(0.2)
    swap.undo()
    expect(swap.setup.value.region).toEqual(HAND_EXAMPLE.region)
    swap.redo()
    expect(swap.setup.value.region.x).toBe(0.2)
  })

  it('sends the region, product, resolution and seed, then shows the result', async () => {
    const swap = start()
    swap.pickProduct('tube')
    swap.resolution.value = '4K'
    swap.seed.value = 9
    await finish(swap)

    expect(vi.mocked(renderSwapImage)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        handImageUrl: HAND_EXAMPLE.url,
        productImageUrl: '/images/apps/hand-product-swap/product-tube.png',
        region: HAND_EXAMPLE.region,
        resolution: '4K',
        width: 4096,
        height: 3072,
        seed: 9
      })
    )
    expect(swap.phase.value).toEqual({
      kind: 'done',
      result: { url: 'blob:swapped', seed: 9 }
    })

    swap.edit()
    expect(swap.phase.value.kind).toBe('editing')
    expect(swap.productName.value).toBe('Cream')
  })

  it('cancels a run and keeps editing', async () => {
    const swap = start()
    const run = swap.swap()
    swap.cancel()
    await vi.runAllTimersAsync()
    await run
    expect(swap.phase.value.kind).toBe('editing')
  })

  it('starts an uploaded hand photo on a centred box and keeps the product', async () => {
    const swap = start()
    swap.pickProduct('serum')
    await swap.useHandFile(new File(['x'], 'mine.png', { type: 'image/png' }))

    expect(swap.hand.value).toEqual({
      url: 'blob:upload',
      name: 'mine.png',
      width: 800,
      height: 1000
    })
    expect(swap.setup.value.region).toEqual(STARTING_BOX)
    expect(swap.productName.value).toBe('Serum')
    expect(swap.canUndo.value).toBe(false)
  })

  it('picks an uploaded product, named by its file', async () => {
    const swap = start()
    await swap.useProductFile(
      new File(['x'], 'bottle.png', { type: 'image/png' })
    )
    expect(swap.product.value.url).toBe('blob:upload')
    expect(swap.productName.value).toBe('bottle.png')
    expect(swap.products.value).toHaveLength(4)

    swap.undo()
    expect(swap.productName.value).toBe('Can')
  })
})
