import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { HAND_EXAMPLE } from '@/lib/workshop/hand-product-swap/examples'
import { renderSwapImage } from '@/lib/workshop/hand-product-swap/render-swap'
import { useHandProductSwap } from './useHandProductSwap'

vi.mock(import('@/lib/workshop/hand-product-swap/render-swap'), () => ({
  renderSwapImage: vi.fn(() => Promise.resolve('blob:swapped'))
}))

vi.mock(import('@/lib/workshop/image-size'), () => ({
  imageSize: vi.fn(() => Promise.resolve({ width: 800, height: 1000 }))
}))

let scope: EffectScope

function create() {
  const swap = scope.run(() => useHandProductSwap('en'))
  if (!swap) throw new Error('no scope')
  return swap
}

function start() {
  const swap = create()
  swap.useExample()
  return swap
}

async function finish(swap: ReturnType<typeof useHandProductSwap>) {
  const run = swap.swap()
  await vi.runAllTimersAsync()
  await run
}

const image = (name: string) => new File(['x'], name, { type: 'image/png' })

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:upload')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('useHandProductSwap', () => {
  it('opens the example with the sparkling can picked at 2K', () => {
    const swap = start()
    expect(swap.productName.value).toBe('Can')
    expect(swap.resolution.value).toBe('2K')
    expect(swap.canRun.value).toBe(true)
    expect(swap.canUndo.value).toBe(false)
  })

  it('undoes and redoes a product pick and a resolution change', () => {
    const swap = start()
    swap.pickProduct('serum')
    swap.resolution.value = '4K'

    swap.undo()
    expect(swap.resolution.value).toBe('2K')
    expect(swap.productName.value).toBe('Serum')
    swap.undo()
    expect(swap.productName.value).toBe('Can')
    expect(swap.canUndo.value).toBe(false)
    swap.redo()
    expect(swap.productName.value).toBe('Serum')
  })

  it.for([
    { product: 'can', result: 'result-can.jpg' },
    { product: 'serum', result: 'result-serum.jpg' },
    { product: 'tube', result: 'result-tube.jpg' }
  ])(
    'shows the example photo of the hand holding the $product',
    async ({ product, result }) => {
      const swap = start()
      swap.pickProduct(product)
      await finish(swap)

      expect(swap.phase.value).toEqual({
        kind: 'done',
        result: { url: `/images/apps/hand-product-swap/${result}`, seed: 42 }
      })
      expect(swap.comparing.value).toBe(false)
      expect(vi.mocked(renderSwapImage)).not.toHaveBeenCalled()
    }
  )

  it('sends exactly the hand, the product, the resolution and the seed', async () => {
    const swap = start()
    await swap.useProductFile(image('bottle.png'))
    swap.resolution.value = '4K'
    swap.seed.value = 9
    await finish(swap)

    expect(vi.mocked(renderSwapImage)).toHaveBeenLastCalledWith({
      hand: HAND_EXAMPLE.url,
      product: 'blob:upload',
      resolution: '4K',
      seed: 9
    })
    expect(swap.phase.value).toEqual({
      kind: 'done',
      result: { url: 'blob:swapped', seed: 9 }
    })

    swap.edit()
    expect(swap.phase.value.kind).toBe('editing')
    expect(swap.productName.value).toBe('bottle.png')
  })

  it('reports the run queued, then its percent', async () => {
    const swap = start()
    const run = swap.swap()
    expect(swap.phase.value).toMatchObject({
      kind: 'running',
      progress: { kind: 'queued' }
    })
    await vi.advanceTimersByTimeAsync(1400)
    expect(swap.phase.value).toMatchObject({
      kind: 'running',
      progress: { kind: 'running', percent: 50 }
    })
    await vi.runAllTimersAsync()
    await run
    expect(swap.phase.value.kind).toBe('done')
  })

  it('cancels a run and keeps editing', async () => {
    const swap = start()
    const run = swap.swap()
    swap.cancel()
    await vi.runAllTimersAsync()
    await run
    expect(swap.phase.value.kind).toBe('editing')
  })

  it('keeps the product and resolution for an uploaded hand photo', async () => {
    const swap = start()
    swap.pickProduct('serum')
    swap.resolution.value = '1K'
    await swap.useHandFile(image('mine.png'))

    expect(swap.hand.value).toEqual({
      url: 'blob:upload',
      name: 'mine.png',
      width: 800,
      height: 1000
    })
    expect(swap.productName.value).toBe('Serum')
    expect(swap.resolution.value).toBe('1K')
    expect(swap.canUndo.value).toBe(false)
  })

  it('picks an uploaded product, named by its file', async () => {
    const swap = start()
    await swap.useProductFile(image('bottle.png'))
    expect(swap.product.value.url).toBe('blob:upload')
    expect(swap.productName.value).toBe('bottle.png')
    expect(swap.products.value).toHaveLength(4)

    swap.undo()
    expect(swap.productName.value).toBe('Can')
  })

  it('takes a pasted image as the hand photo first, then as the product', async () => {
    const swap = create()
    await swap.usePastedFile(image('hand.png'))
    expect(swap.hand.value?.name).toBe('hand.png')

    await swap.usePastedFile(image('bottle.png'))
    expect(swap.hand.value?.name).toBe('hand.png')
    expect(swap.productName.value).toBe('bottle.png')
  })

  it('goes back to editing when a new product arrives over a result', async () => {
    const swap = start()
    await finish(swap)
    await swap.useProductFile(image('bottle.png'))
    expect(swap.phase.value.kind).toBe('editing')
  })

  it('ignores a dropped image while a run is going', async () => {
    const swap = start()
    const run = swap.swap()
    await swap.useHandFile(image('mine.png'))
    expect(swap.hand.value?.url).toBe(HAND_EXAMPLE.url)
    expect(swap.phase.value.kind).toBe('running')
    await vi.runAllTimersAsync()
    await run
  })
})
