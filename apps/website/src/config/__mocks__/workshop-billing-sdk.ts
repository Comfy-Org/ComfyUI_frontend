import { vi } from 'vitest'

import type { TopupCommand } from '@comfyorg/account-core/billing'

import type * as realBillingSdk from '@/config/workshop-billing-sdk'

const command = vi.mockObject<TopupCommand>(
  {
    quoteTopup: async () => ({ status: 'error', code: 'NOT_AVAILABLE' }),
    createHostedTopupCheckout: async () => ({
      status: 'error',
      code: 'NOT_AVAILABLE'
    }),
    createTopupCheckout: async () => ({
      status: 'error',
      code: 'NOT_AVAILABLE'
    })
  },
  { spy: true }
)

const billingSdk: typeof realBillingSdk = {
  workshopTopupCommand: vi.fn(() => command)
}

export const { workshopTopupCommand } = billingSdk
