import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as BuyCredits from './workshop-buy-credits'

type Request = (module: typeof BuyCredits) => void

const action: Request = (module) => module.requestWorkshopBuyCredits()
const automatic: Request = (module) =>
  module.requestWorkshopBuyCreditsAutomatically()

beforeEach(() => {
  vi.resetModules()
})

describe('workshop buy-credits requests', () => {
  it.for([
    { name: 'action then automatic', first: action, second: automatic },
    { name: 'automatic then action', first: automatic, second: action }
  ])(
    'buffers $name before a subscriber as the action',
    async ({ first, second }) => {
      const module = await import('./workshop-buy-credits')
      first(module)
      second(module)
      const listener = vi.fn()

      module.subscribeToWorkshopBuyCredits(listener)

      expect(listener).toHaveBeenCalledExactlyOnceWith('action')
    }
  )

  it('buffers a lone automatic request as automatic', async () => {
    const module = await import('./workshop-buy-credits')
    automatic(module)
    const listener = vi.fn()

    module.subscribeToWorkshopBuyCredits(listener)

    expect(listener).toHaveBeenCalledExactlyOnceWith('automatic')
  })
})
