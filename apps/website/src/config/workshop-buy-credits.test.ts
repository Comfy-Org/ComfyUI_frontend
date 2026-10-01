import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('workshop buy-credits requests', () => {
  it.for([
    { order: ['action', 'automatic'], delivered: 'action' },
    { order: ['automatic', 'action'], delivered: 'action' },
    { order: ['automatic'], delivered: 'automatic' }
  ] as const)(
    'buffers $order before a subscriber as $delivered',
    async ({ order, delivered }) => {
      const {
        requestWorkshopBuyCredits,
        requestWorkshopBuyCreditsAutomatically,
        subscribeToWorkshopBuyCredits
      } = await import('./workshop-buy-credits')
      for (const trigger of order) {
        if (trigger === 'action') requestWorkshopBuyCredits()
        else requestWorkshopBuyCreditsAutomatically()
      }
      const listener = vi.fn()

      subscribeToWorkshopBuyCredits(listener)

      expect(listener).toHaveBeenCalledExactlyOnceWith(delivered)
    }
  )
})
